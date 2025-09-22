import { sanitizeInput, makeAddressKey } from "@utils/addressHandling";
import { describe, it, expect } from "@jest/globals";

describe("sanitizeInput", () => {
  it("should remove HTML tags", () => {
    const input = "<script>alert('xss')</script>Hello World";
    const result = sanitizeInput(input);
    expect(result).toBe("alert(xss)Hello World");
  });

  it("should remove dangerous characters", () => {
    const input = 'Hello &\' "World" <script>';
    const result = sanitizeInput(input);
    expect(result).toBe("Hello & World");
  });

  it("should trim whitespace", () => {
    const input = "  Hello World  ";
    const result = sanitizeInput(input);
    expect(result).toBe("Hello World");
  });

  it("should limit length to 500 characters", () => {
    const input = "a".repeat(600);
    const result = sanitizeInput(input);
    expect(result).toHaveLength(500);
  });

  it("should return empty string for invalid input", () => {
    expect(sanitizeInput(null as unknown as string)).toBe("");
    expect(sanitizeInput(undefined as unknown as string)).toBe("");
    expect(sanitizeInput(123 as unknown as string)).toBe("");
  });

  it("should handle empty string", () => {
    const result = sanitizeInput("");
    expect(result).toBe("");
  });

  it("should handle string with only whitespace", () => {
    const input = "   ";
    const result = sanitizeInput(input);
    expect(result).toBe("");
  });

  it("should handle mixed HTML and dangerous characters", () => {
    const input = '<div>Hello &amp; "quoted" text</div>';
    const result = sanitizeInput(input);
    expect(result).toBe("Hello &amp; quoted text");
  });
});

describe("makeAddressKey", () => {
  it("should convert address to lowercase", () => {
    const input = "123 MAIN ST, NEW YORK, NY 10001, USA";
    const result = makeAddressKey(input);
    expect(result).toBe("123_main_st_new_york_ny_10001_usa");
  });

  it("should replace spaces with underscores", () => {
    const input = "123 Main Street, New York";
    const result = makeAddressKey(input);
    expect(result).toBe("123_main_street_new_york");
  });

  it("should remove special characters and punctuation", () => {
    const input = "123 Main St., #456, New York, NY!";
    const result = makeAddressKey(input);
    expect(result).toBe("123_main_st_456_new_york_ny");
  });

  it("should replace hyphens with underscores", () => {
    const input = "123 Twenty-First Street, North-West Avenue";
    const result = makeAddressKey(input);
    expect(result).toBe("123_twenty_first_street_north_west_avenue");
  });

  it("should handle multiple consecutive spaces", () => {
    const input = "123    Main     Street";
    const result = makeAddressKey(input);
    expect(result).toBe("123_main_street");
  });

  it("should handle multiple consecutive hyphens", () => {
    const input = "123 Main---Street Avenue--North";
    const result = makeAddressKey(input);
    expect(result).toBe("123_main_street_avenue_north");
  });

  it("should consolidate multiple underscores", () => {
    const input = "123_____Main_Street";
    const result = makeAddressKey(input);
    expect(result).toBe("123_main_street");
  });

  it("should remove leading and trailing underscores", () => {
    const input = "___123 Main Street___";
    const result = makeAddressKey(input);
    expect(result).toBe("123_main_street");
  });

  it("should handle typical US address format", () => {
    const input = "1600 Amphitheatre Parkway, Mountain View, CA 94043, USA";
    const result = makeAddressKey(input);
    expect(result).toBe("1600_amphitheatre_parkway_mountain_view_ca_94043_usa");
  });

  it("should handle address with apartment/unit numbers", () => {
    const input = "123 Main St, Apt 4B, New York, NY 10001";
    const result = makeAddressKey(input);
    expect(result).toBe("123_main_st_apt_4b_new_york_ny_10001");
  });

  it("should handle addresses with parentheses", () => {
    const input = "123 Main St (Building A), New York";
    const result = makeAddressKey(input);
    expect(result).toBe("123_main_st_building_a_new_york");
  });

  it("should handle addresses with various punctuation", () => {
    const input = "123 Main St., Suite #456, New York, NY @ 10001!";
    const result = makeAddressKey(input);
    expect(result).toBe("123_main_st_suite_456_new_york_ny_10001");
  });

  it("should handle empty string", () => {
    const result = makeAddressKey("");
    expect(result).toBe("");
  });

  it("should handle null input", () => {
    const result = makeAddressKey(null as unknown as string);
    expect(result).toBe("");
  });

  it("should handle undefined input", () => {
    const result = makeAddressKey(undefined as unknown as string);
    expect(result).toBe("");
  });

  it("should handle non-string input", () => {
    const result = makeAddressKey(123 as unknown as string);
    expect(result).toBe("");
  });

  it("should handle string with only spaces", () => {
    const input = "     ";
    const result = makeAddressKey(input);
    expect(result).toBe("");
  });

  it("should handle string with only special characters", () => {
    const input = "!@#$%^&*()";
    const result = makeAddressKey(input);
    expect(result).toBe("");
  });

  it("should limit length to 200 characters", () => {
    const longAddress =
      "A".repeat(250) + " Very Long Street Name " + "B".repeat(250);
    const result = makeAddressKey(longAddress);
    expect(result.length).toBeLessThanOrEqual(200);
  });

  it("should handle addresses with numbers only", () => {
    const input = "12345";
    const result = makeAddressKey(input);
    expect(result).toBe("12345");
  });

  it("should handle international characters (accents)", () => {
    const input = "123 Café Street, São Paulo";
    const result = makeAddressKey(input);
    expect(result).toBe("123_caf_street_so_paulo");
  });

  it("should handle mixed case with numbers", () => {
    const input = "123ABC Main St 456XYZ";
    const result = makeAddressKey(input);
    expect(result).toBe("123abc_main_st_456xyz");
  });

  it("should handle address with quotation marks", () => {
    const input = "123 \"Main\" Street, 'New' York";
    const result = makeAddressKey(input);
    expect(result).toBe("123_main_street_new_york");
  });

  it("should handle address with forward and back slashes", () => {
    const input = "123 Main/Side Street\\Alley";
    const result = makeAddressKey(input);
    expect(result).toBe("123_mainside_streetalley");
  });

  it("should create consistent keys for similar addresses", () => {
    const address1 = "123 Main Street, New York, NY";
    const address2 = "123   MAIN   STREET,   NEW   YORK,   NY";
    const address3 = "123-Main-Street,-New-York,-NY";

    const key1 = makeAddressKey(address1);
    const key2 = makeAddressKey(address2);
    const key3 = makeAddressKey(address3);

    expect(key1).toBe(key2);
    expect(key2).toBe(key3);
    expect(key1).toBe("123_main_street_new_york_ny");
  });

  it("should handle real Google Maps formatted address", () => {
    const input = "1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA";
    const result = makeAddressKey(input);
    expect(result).toBe("1600_amphitheatre_pkwy_mountain_view_ca_94043_usa");
  });

  it("should handle address with establishment name", () => {
    const input =
      "Google Headquarters, 1600 Amphitheatre Parkway, Mountain View, CA";
    const result = makeAddressKey(input);
    expect(result).toBe(
      "google_headquarters_1600_amphitheatre_parkway_mountain_view_ca"
    );
  });

  it("should produce Firebase-safe keys (no forbidden characters)", () => {
    const input = "123 Main St., New York, NY [Apt #4]";
    const result = makeAddressKey(input);

    // Firebase keys cannot contain: . $ # [ ] /
    expect(result).not.toMatch(/[.$#\[\]/]/);
    expect(result).toBe("123_main_st_new_york_ny_apt_4");
  });
});
