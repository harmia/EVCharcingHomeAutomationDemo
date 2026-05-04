const { optimize, isHourInWindow } = require('../src/optimize');

// ── isHourInWindow ────────────────────────────────────────
describe('isHourInWindow', () => {
  it('simple window (no midnight crossing)', () => {
    expect(isHourInWindow(5, 1, 10)).toBe(true);
    expect(isHourInWindow(1, 1, 10)).toBe(true);   // inclusive start
    expect(isHourInWindow(10, 1, 10)).toBe(false);  // exclusive end
    expect(isHourInWindow(0, 1, 10)).toBe(false);
    expect(isHourInWindow(11, 1, 10)).toBe(false);
  });

  it('midnight-crossing window (e.g. 22:00 – 07:00)', () => {
    expect(isHourInWindow(22, 22, 7)).toBe(true);
    expect(isHourInWindow(23, 22, 7)).toBe(true);
    expect(isHourInWindow(0, 22, 7)).toBe(true);
    expect(isHourInWindow(6, 22, 7)).toBe(true);
    expect(isHourInWindow(7, 22, 7)).toBe(false);   // exclusive end
    expect(isHourInWindow(12, 22, 7)).toBe(false);
    expect(isHourInWindow(21, 22, 7)).toBe(false);
  });
});

// ── optimize ──────────────────────────────────────────────
const allDay = Array.from({ length: 24 }, (_, i) => ({ hour: i, price: (i + 1) * 1.0 }));
// prices: hour 0 = 1 snt/kWh (cheapest), hour 23 = 24 snt/kWh (most expensive)

describe('optimize – basic selection', () => {
  it('picks the cheapest N hours', () => {
    const result = optimize({ prices: allDay, hoursNeeded: 3, windowStart: 0, windowEnd: 24 });
    expect(result).toEqual([0, 1, 2]);  // hours 0,1,2 have prices 1,2,3
  });

  it('returns hours sorted ascending', () => {
    const prices = [
      { hour: 5, price: 1.0 },
      { hour: 2, price: 3.0 },
      { hour: 9, price: 2.0 },
    ];
    const result = optimize({ prices, hoursNeeded: 2, windowStart: 0, windowEnd: 24 });
    expect(result).toEqual([5, 9]);  // cheapest two: hour 5 (1.0) and hour 9 (2.0)
  });

  it('picks exactly one hour', () => {
    const result = optimize({ prices: allDay, hoursNeeded: 1, windowStart: 0, windowEnd: 24 });
    expect(result).toEqual([0]);
  });
});

describe('optimize – energy → hours conversion', () => {
  it('converts energyNeeded / chargingPower to hours (ceiling)', () => {
    // 22 kWh ÷ 11 kW = 2 hours
    const result = optimize({ prices: allDay, energyNeeded: 22, chargingPower: 11, windowStart: 0, windowEnd: 24 });
    expect(result).toHaveLength(2);
    expect(result).toEqual([0, 1]);
  });

  it('rounds up fractional hours', () => {
    // 25 kWh ÷ 11 kW = 2.27 → ceil = 3 hours
    const result = optimize({ prices: allDay, energyNeeded: 25, chargingPower: 11, windowStart: 0, windowEnd: 24 });
    expect(result).toHaveLength(3);
  });

  it('uses default chargingPower of 11 kW when not specified', () => {
    const result = optimize({ prices: allDay, energyNeeded: 11, windowStart: 0, windowEnd: 24 });
    expect(result).toHaveLength(1);
  });
});

describe('optimize – time window', () => {
  it('respects a simple daytime window', () => {
    // Only hours 8-17 are allowed; cheapest 2 within that range are hours 8 and 9
    const result = optimize({ prices: allDay, hoursNeeded: 2, windowStart: 8, windowEnd: 18 });
    expect(result).toEqual([8, 9]);
  });

  it('respects a midnight-crossing window (22–07)', () => {
    // Available: hours 22,23,0,1,2,3,4,5,6  (prices 23,24,1,2,3,4,5,6,7)
    // Cheapest 3: hours 0(1), 1(2), 2(3)
    const result = optimize({ prices: allDay, hoursNeeded: 3, windowStart: 22, windowEnd: 7 });
    expect(result).toEqual([0, 1, 2]);
  });
});

describe('optimize – targetReadyBy', () => {
  it('excludes hours at or after targetReadyBy', () => {
    // Window 0-24, targetReadyBy=3 → only hours 0,1,2 allowed
    const result = optimize({ prices: allDay, hoursNeeded: 2, windowStart: 0, windowEnd: 24, targetReadyBy: 3 });
    expect(result).toEqual([0, 1]);
    expect(result.every(h => h < 3)).toBe(true);
  });
});

describe('optimize – error cases', () => {
  it('throws when neither hoursNeeded nor energyNeeded is provided', () => {
    expect(() => optimize({ prices: allDay, windowStart: 0, windowEnd: 24 }))
      .toThrow('hoursNeeded or energyNeeded must be provided');
  });

  it('throws when there are not enough hours in the window', () => {
    // Window 10–12 → only 2 available hours; asking for 5
    expect(() => optimize({ prices: allDay, hoursNeeded: 5, windowStart: 10, windowEnd: 12 }))
      .toThrow(/Not enough hours/);
  });

  it('throws when the window contains no hours at all', () => {
    expect(() => optimize({ prices: [], hoursNeeded: 1, windowStart: 0, windowEnd: 24 }))
      .toThrow(/No hours available/);
  });
});
