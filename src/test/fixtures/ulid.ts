import { vi, afterEach } from "vitest";

export const SEED_ULID_1 = "01HZAA0000AAAAAAAAAAAAAAAA";
export const SEED_ULID_2 = "01HZAA0000AAAAAAAAAAAAAAB0";
export const SEED_ULID_3 = "01HZAA0000AAAAAAAAAAAAAAC0";
export const SEED_ULID_4 = "01HZAA0000AAAAAAAAAAAAAAD0";
export const SEED_ULID_5 = "01HZAA0000AAAAAAAAAAAAAAE0";
export const SEED_ULID_6 = "01HZAA0000AAAAAAAAAAAAAAF0";
export const SEED_ULID_7 = "01HZAA0000AAAAAAAAAAAAAAG0";
export const SEED_ULID_8 = "01HZAA0000AAAAAAAAAAAAAAH0";
export const SEED_ULID_9 = "01HZAA0000AAAAAAAAAAAAAAJ0";
export const SEED_ULID_10 = "01HZAA0000AAAAAAAAAAAAAAK0";

const ALL_SEEDS = [
  SEED_ULID_1, SEED_ULID_2, SEED_ULID_3, SEED_ULID_4, SEED_ULID_5,
  SEED_ULID_6, SEED_ULID_7, SEED_ULID_8, SEED_ULID_9, SEED_ULID_10,
];

let mockRestore: (() => void) | null = null;

export function mockUlidSeq(start: number = 1): void {
  if (mockRestore) mockRestore();

  let idx = start - 1;
  const mock = vi.fn(() => {
    if (idx >= ALL_SEEDS.length) {
      throw new Error(`mockUlidSeq exhausted: requested index ${idx + 1}, only ${ALL_SEEDS.length} seeds available`);
    }
    return ALL_SEEDS[idx++];
  });

  mockRestore = () => {
    mock.mockRestore();
    mockRestore = null;
  };

  afterEach(() => {
    if (mockRestore) {
      mockRestore();
    }
  });

  vi.doMock("ulid", () => ({
    monotonicFactory: () => mock,
    ulid: mock,
  }));
}
