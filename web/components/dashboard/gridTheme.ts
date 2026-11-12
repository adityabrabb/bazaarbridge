/**
 * AG Grid theme: Quartz tuned to the export-ledger look (ink header with
 * yellow type, paper rows, ink rules). Kept apart from the grid
 * component so the colours live in one place.
 */
import { themeQuartz } from "ag-grid-community";
import { GRID_HEADER_HEIGHT, GRID_ROW_HEIGHT } from "@/lib/constants";

export const exportTheme = themeQuartz.withParams({
   backgroundColor: "#fffaf0",
   foregroundColor: "#10153a",
   headerBackgroundColor: "#10153a",
   headerTextColor: "#ffb81c",
   headerFontWeight: 700,
   oddRowBackgroundColor: "#f8ecd2",
   borderColor: "#10153a33",
   rowHoverColor: "#ffb81c55",
   accentColor: "#e3342f",
   fontFamily: "inherit",
   fontSize: 15,
   rowHeight: GRID_ROW_HEIGHT,
   headerHeight: GRID_HEADER_HEIGHT,
   wrapperBorderRadius: 0,
   wrapperBorder: false,
});
