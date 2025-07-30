import functionsTest from "firebase-functions-test";
import { recalculateStats } from "../../index";

jest.mock("firebase-admin", () => {
  const mockSet = jest.fn().mockResolvedValue(true);
  const mockOnce = jest.fn().mockResolvedValue({
    val: jest.fn().mockReturnValue({
      location1: { addedAt: "2025-07-28T00:00:00.000Z" },
      location2: { addedAt: "2025-07-27T00:00:00.000Z" },
      location3: { addedAt: "2025-07-20T00:00:00.000Z" },
    }),
  });
  const mockRef = jest.fn((path?: string) => {
    if (path === "locations") return { once: mockOnce };
    if (path === "stats") return { set: mockSet };
    return {};
  });
  const OLD_PINS_COUNT = 2;
  const mockGet = jest.fn().mockResolvedValue({ size: OLD_PINS_COUNT });
  const mockCollection = jest.fn((name?: string) => {
    if (name === "old-pins") return { get: mockGet };
    return { add: jest.fn() }; // for any other collections
  });
  const mockFirestore = jest.fn(() => ({ collection: mockCollection }));

  return {
    initializeApp: jest.fn(),
    database: jest.fn(() => ({ ref: mockRef })),
    firestore: mockFirestore,
  };
});

const testEnv = functionsTest({ projectId: "iceinmyarea" });
const wrappedRecalculateStats = testEnv.wrap(recalculateStats);

const FIXED_NOW = new Date("2025-07-28T12:00:00Z");

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(FIXED_NOW);
});

afterAll(() => {
  jest.useRealTimers();
  testEnv.cleanup();
});

afterEach(() => jest.clearAllMocks());

describe("recalculateStats – integration", () => {
  const OLD_PINS_COUNT = 2;
  it("recalculates stats using live and old pins", async () => {
    const admin = require("firebase-admin");
    const mockSet = admin.database().ref("stats").set;
    const mockCollection = admin.firestore().collection;

    const res = await wrappedRecalculateStats({} as any);

    expect(mockCollection).toHaveBeenCalledWith("old-pins"); // Firestore read

    expect(mockSet).toHaveBeenCalledWith({
      total_pins: OLD_PINS_COUNT + 3, // 2 old + 3 live
      today_pins: 1, // only live pins
      week_pins: 2, // only live pins
    });
    expect(res).toEqual({ message: "Stats recalculated successfully" });
  });

  it("handles empty RTDB gracefully (old pins only)", async () => {
    const admin = require("firebase-admin");
    const mockOnce = admin.database().ref("locations").once;
    const mockSet = admin.database().ref("stats").set;

    mockOnce.mockResolvedValueOnce({ val: jest.fn().mockReturnValue(null) });

    const res = await wrappedRecalculateStats({} as any);

    expect(mockSet).toHaveBeenCalledWith({
      total_pins: OLD_PINS_COUNT, // only the Firestore count
      today_pins: 0,
      week_pins: 0,
    });
    expect(res).toEqual({ message: "Stats recalculated successfully" });
  });

  it("handles no old pins in Firestore gracefully", async () => {
    const admin = require("firebase-admin");
    const mockOnce = admin.database().ref("locations").once;
    const mockSet = admin.database().ref("stats").set;
    const mockGet = admin.firestore().collection("old-pins").get;

    mockOnce.mockResolvedValueOnce({
      val: jest.fn().mockReturnValue({
        location1: { addedAt: "2025-07-28T00:00:00.000Z" },
      }),
    });
    mockGet.mockResolvedValueOnce({ size: 0 }); // No old pins

    const res = await wrappedRecalculateStats({} as any);

    expect(mockSet).toHaveBeenCalledWith({
      total_pins: 1, // Only live pins
      today_pins: 1,
      week_pins: 1,
    });
    expect(res).toEqual({ message: "Stats recalculated successfully" });
  });

  it("correctly calculates week pins for boundary dates", async () => {
    const admin = require("firebase-admin");
    const mockOnce = admin.database().ref("locations").once;
    const mockSet = admin.database().ref("stats").set;

    // Mock today's date to align with the test logic
    const FIXED_NOW = new Date("2025-07-28T00:00:00.000Z");
    jest.setSystemTime(FIXED_NOW);

    mockOnce.mockResolvedValueOnce({
      val: jest.fn().mockReturnValue({
        location1: { addedAt: "2025-07-21T00:00:00.000Z" }, // Exactly 7 days ago
        location2: { addedAt: "2025-07-20T23:59:59.999Z" }, // Just outside 7 days
      }),
    });

    const res = await wrappedRecalculateStats({} as any);

    expect(mockSet).toHaveBeenCalledWith({
      total_pins: OLD_PINS_COUNT + 2,
      today_pins: 0,
      week_pins: 1, // Only location1 is within the week
    });
    expect(res).toEqual({ message: "Stats recalculated successfully" });
  });
});
