/**
 * AG Grid theme: Quartz tuned to the ledger sheet (cream rows, a
 * quiet small-caps header, hairline rules; no fills, no banding).
 * Kept apart from the grid component so the colours live in one place.
 */
import { themeQuartz } from "ag-grid-community";
import { GRID_HEADER_HEIGHT, GRID_ROW_HEIGHT } from "@/lib/constants";

export const exportTheme = themeQuartz.withParams({
   backgroundColor: "#fffaf0",
   foregroundColor: "#10153a",
   headerBackgroundColor: "#fffaf0",
   headerTextColor: "#10153a",
   headerFontSize: 12,
   headerFontWeight: 700,
   oddRowBackgroundColor: "#fffaf0",
   borderColor: "#10153a26",
   columnBorder: false,
   headerColumnBorder: false,
   headerColumnResizeHandleColor: "transparent",
   rowHoverColor: "#ffb81c33",
   accentColor: "#e3342f",
   fontFamily: "inherit",
   fontSize: 15,
   spacing: 8,
   rowHeight: GRID_ROW_HEIGHT,
   headerHeight: GRID_HEADER_HEIGHT,
   wrapperBorderRadius: 0,
   wrapperBorder: false,
});
