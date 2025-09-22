import { recalculateStats } from "../../migrations";

// Mock Firebase Admin to isolate unit testing
const mockSet = jest.fn().mockResolvedValue(true);
const mockOnce = jest.fn();
const mockRef = jest.fn((path?: string) => {
  if (path === "locations") return { once: mockOnce };
  if (path === "stats") return { set: mockSet };
  return {};
});

const mockGet = jest.fn();
const mockCollection = jest.fn((name?: string) => {
  if (name === "old-pins") return { get: mockGet };
  return { add: jest.fn() }; // for any other collections
});

const mockRealtimeDb = { ref: mockRef };
const mockFirestoreDb = { collection: mockCollection };

const FIXED_NOW = new Date("2025-07-28T12:00:00Z");

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(FIXED_NOW);
});

afterAll(() => {
  jest.useRealTimers();
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("recalculateStats – integration", () => {
  it("recalculates stats using live and old pins with reported counts", async () => {
    // Set up mock data with reported counts
    mockOnce.mockResolvedValue({
      val: jest.fn().mockReturnValue({
        location1: {
          addedAt: "2025-07-28T00:00:00.000Z",
          reported: 3, // 3 reports for today
        },
        location2: {
          addedAt: "2025-07-27T00:00:00.000Z",
          reported: 2, // 2 reports for this week
        },
        location3: {
          addedAt: "2025-07-20T00:00:00.000Z",
          reported: 1, // 1 report (older than week)
        },
      }),
    });

    // Mock Firestore old pins with reported counts
    const mockOldPinsDocs = [
      { data: () => ({ addedAt: "2025-07-10T00:00:00.000Z", reported: 4 }) },
      { data: () => ({ addedAt: "2025-07-05T00:00:00.000Z", reported: 2 }) },
    ];
    mockGet.mockResolvedValue({ docs: mockOldPinsDocs });

    const res = await recalculateStats(
      mockRealtimeDb as any,
      mockFirestoreDb as any
    );

    expect(mockCollection).toHaveBeenCalledWith("old-pins"); // Firestore read

    expect(mockSet).toHaveBeenCalledWith({
      total_pins: 12, // (3+2+1) live + (4+2) old = 12 total reports
      today_pins: 3, // 3 reports today
      week_pins: 5, // 3 today + 2 this week = 5 reports
    });
    expect(res).toEqual({ message: "Stats recalculated successfully" });
  });

  it("handles empty RTDB gracefully (old pins only)", async () => {
    mockOnce.mockResolvedValueOnce({ val: jest.fn().mockReturnValue(null) });

    // Mock Firestore old pins with reported counts
    const mockOldPinsDocs = [
      { data: () => ({ addedAt: "2025-07-10T00:00:00.000Z", reported: 5 }) },
      { data: () => ({ addedAt: "2025-07-05T00:00:00.000Z", reported: 3 }) },
    ];
    mockGet.mockResolvedValue({ docs: mockOldPinsDocs });

    const res = await recalculateStats(
      mockRealtimeDb as any,
      mockFirestoreDb as any
    );

    expect(mockSet).toHaveBeenCalledWith({
      total_pins: 8, // 5+3 from old pins only
      today_pins: 0,
      week_pins: 0,
    });
    expect(res).toEqual({ message: "Stats recalculated successfully" });
  });

  it("handles no old pins in Firestore gracefully", async () => {
    mockOnce.mockResolvedValueOnce({
      val: jest.fn().mockReturnValue({
        location1: {
          addedAt: "2025-07-28T00:00:00.000Z",
          reported: 4, // 4 reports today
        },
      }),
    });
    mockGet.mockResolvedValueOnce({ docs: [] }); // No old pins

    const res = await recalculateStats(
      mockRealtimeDb as any,
      mockFirestoreDb as any
    );

    expect(mockSet).toHaveBeenCalledWith({
      total_pins: 4, // Only live pin reports
      today_pins: 4, // 4 reports today
      week_pins: 4, // 4 reports this week
    });
    expect(res).toEqual({ message: "Stats recalculated successfully" });
  });

  it("correctly calculates week pins for boundary dates with reported counts", async () => {
    // Mock today's date to align with the test logic
    const FIXED_NOW = new Date("2025-07-28T00:00:00.000Z");
    jest.setSystemTime(FIXED_NOW);

    mockOnce.mockResolvedValueOnce({
      val: jest.fn().mockReturnValue({
        location1: {
          addedAt: "2025-07-21T00:00:00.000Z", // Exactly 7 days ago
          reported: 3, // 3 reports exactly 7 days ago
        },
        location2: {
          addedAt: "2025-07-20T23:59:59.999Z", // Just outside 7 days
          reported: 2, // 2 reports outside week range
        },
      }),
    });

    // Mock Firestore old pins
    const mockOldPinsDocs = [
      { data: () => ({ addedAt: "2025-07-10T00:00:00.000Z", reported: 4 }) },
    ];
    mockGet.mockResolvedValue({ docs: mockOldPinsDocs });

    const res = await recalculateStats(
      mockRealtimeDb as any,
      mockFirestoreDb as any
    );

    expect(mockSet).toHaveBeenCalledWith({
      total_pins: 9, // 3+2 live + 4 old = 9 total reports
      today_pins: 0, // No reports today
      week_pins: 3, // Only location1 is within the week (3 reports)
    });
    expect(res).toEqual({ message: "Stats recalculated successfully" });
  });

  it("handles missing reported field by defaulting to 1", async () => {
    mockOnce.mockResolvedValueOnce({
      val: jest.fn().mockReturnValue({
        location1: {
          addedAt: "2025-07-28T00:00:00.000Z",
          // missing reported field - should default to 1
        },
        location2: {
          addedAt: "2025-07-27T00:00:00.000Z",
          // missing reported field - should default to 1
        },
      }),
    });

    // Mock Firestore old pins without reported field
    const mockOldPinsDocs = [
      { data: () => ({ addedAt: "2025-07-10T00:00:00.000Z" }) }, // missing reported
      { data: () => ({ addedAt: "2025-07-05T00:00:00.000Z" }) }, // missing reported
    ];
    mockGet.mockResolvedValue({ docs: mockOldPinsDocs });

    const res = await recalculateStats(
      mockRealtimeDb as any,
      mockFirestoreDb as any
    );

    expect(mockSet).toHaveBeenCalledWith({
      total_pins: 4, // 1+1 live + 1+1 old = 4 (all default to 1)
      today_pins: 1, // 1 report today (default)
      week_pins: 2, // 2 reports this week (both live pins default to 1)
    });
    expect(res).toEqual({ message: "Stats recalculated successfully" });
  });
});
