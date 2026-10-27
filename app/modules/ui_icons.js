function uiIcon(name) {
  const paths = {
    tools: "M9 3h6l1 4 4 1v6l-4 1-1 4H9l-1-4-4-1V8l4-1z M9 11a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
    search: "M10 3a7 7 0 1 0 0 14a7 7 0 1 0 0-14 M15 15l6 6",
    calendar: "M4 5h16v16H4z M4 10h16 M8 3v4 M16 3v4",
    files: "M5 3h9l5 5v13H5z M14 3v6h5 M8 13h8 M8 17h8",
    recover: "M4 11a8 8 0 1 1 2 7 M4 4v7h7 M12 8v5l3 2",
    sync: "M4 7h14l-4-4 M20 17H6l4 4 M18 7l-4 4 M6 17l4-4",
    cases: "M3 6h7l2 2h9v12H3z M3 6V4h7l2 2",
    import: "M12 3v12m-5-5 5 5 5-5 M4 16v5h16v-5",
    library: "M4 3h12a3 3 0 0 1 3 3v15H7a3 3 0 0 1-3-3z M4 17h15 M8 7h7 M8 11h7",
    reports: "M4 21V3 M4 21h17 M8 17v-5 M13 17V7 M18 17V4",
  };
  return (
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="curr' +
    'entColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="rou' +
    'nd" aria-hidden="true"><path d="' +
    `${paths[name] || paths.cases}` +
    '"/></svg>'
  );
}
export { uiIcon };
