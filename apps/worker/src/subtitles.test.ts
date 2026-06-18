import { describe, it, expect } from "vitest";
import { srtTimeToSeconds, parseSrt } from "./subtitles";

describe("srtTimeToSeconds", () => {
  it("parses HH:MM:SS,mmm into seconds", () => {
    expect(srtTimeToSeconds("00:00:00,000")).toBe(0);
    expect(srtTimeToSeconds("00:01:02,500")).toBe(62.5);
    expect(srtTimeToSeconds("01:00:00,000")).toBe(3600);
  });

  it("accepts a dot as the millisecond separator", () => {
    expect(srtTimeToSeconds("00:00:03.250")).toBe(3.25);
  });

  it("returns 0 for an unparseable timestamp", () => {
    expect(srtTimeToSeconds("nonsense")).toBe(0);
  });
});

describe("parseSrt", () => {
  it("parses numbered blocks into cues", () => {
    const srt = "1\n00:00:01,000 --> 00:00:03,000\nHello world\n\n2\n00:00:04,000 --> 00:00:06,000\nSecond line\ncontinues here\n";
    expect(parseSrt(srt)).toEqual([
      { start: 1, end: 3, text: "Hello world" },
      { start: 4, end: 6, text: "Second line\ncontinues here" },
    ]);
  });

  it("handles CRLF line endings and a leading BOM", () => {
    const srt = "﻿1\r\n00:00:00,000 --> 00:00:02,000\r\nHi\r\n";
    expect(parseSrt(srt)).toEqual([{ start: 0, end: 2, text: "Hi" }]);
  });

  it("parses index-less blocks (timecode first)", () => {
    const srt = "00:00:05,000 --> 00:00:07,000\nNo index here\n";
    expect(parseSrt(srt)).toEqual([{ start: 5, end: 7, text: "No index here" }]);
  });

  it("skips blocks without a valid timecode line, with a malformed timecode, or with no text", () => {
    const srt =
      "garbage block\n\n" + // no --> line at all
      "2\nbad --> times\nshould be dropped\n\n" + // has --> but unparseable timecodes
      "3\n00:00:08,000 --> 00:00:09,000\n\n\n" + // valid timecode but empty text
      "4\n00:00:10,000 --> 00:00:12,000\nKept\n";
    expect(parseSrt(srt)).toEqual([{ start: 10, end: 12, text: "Kept" }]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseSrt("")).toEqual([]);
    expect(parseSrt("   \n  \n")).toEqual([]);
  });
});
