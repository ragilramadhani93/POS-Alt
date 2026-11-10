import { describe, it, expect, vi } from 'vitest';
import { MembersService } from './members.service.js';

describe('MembersService Loyalty Engine (Points, Stamps, Tiers)', () => {
  it('harus mengakumulasi poin dengan tier multiplier dan menaikkan tier otomatis', async () => {
    // Member Gold: Belanja Rp 100.000
    // Aturan Poin: Rp 10.000 = 1 Poin * 1.5 (Gold) = 15 Poin
    // Aturan Stamp: Belanja >= Rp 30.000 = 1 Stamp
    // Akumulasi belanja: Rp 950.000 + Rp 100.000 = Rp 1.050.000 -> Naik Tier Gold
    const mockMember = {
      id: 'member-1',
      name: 'Rudi Hartono',
      currentTier: 'Silver',
      totalSpend: 950000,
      totalPoints: 10,
      totalStamps: 2,
    };

    const mockPrisma: any = {
      member: {
        findUnique: vi.fn().mockResolvedValue(mockMember),
        update: vi.fn().mockImplementation(({ data }) => ({ ...mockMember, ...data })),
      },
      memberPoint: {
        create: vi.fn().mockResolvedValue({}),
      },
      memberStamp: {
        create: vi.fn().mockResolvedValue({}),
      },
      memberTierHistory: {
        create: vi.fn().mockResolvedValue({}),
      },
      $transaction: vi.fn().mockImplementation(async (callback) => callback(mockPrisma)),
    };

    const service = new MembersService(mockPrisma);
    const updated = await service.processLoyaltyAfterPayment('member-1', 'trx-123', 100000);

    // Silver tier multiplier 1.0x -> 10 poin
    expect(Number(updated.totalPoints)).toBe(20); // 10 awal + 10 earned
    expect(updated.totalStamps).toBe(3); // 2 awal + 1 stamp
    expect(Number(updated.totalSpend)).toBe(1050000);
    expect(updated.currentTier).toBe('Gold'); // Naik tier karena >= Rp 1.000.000
  });

  it('harus menolak redeem jika saldo poin tidak mencukupi', async () => {
    const mockPrisma: any = {
      member: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'member-1',
          totalPoints: 5, // hanya punya 5 poin
        }),
      },
    };

    const service = new MembersService(mockPrisma);
    await expect(service.redeemPoints('member-1', 10)).rejects.toThrow('Saldo poin tidak mencukupi');
  });
});
