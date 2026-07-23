import { api } from '../api.ts';

// One institution's database from the debug dump, rendered verbatim:
// table name, columns, raw rows — amounts stay the minor-unit strings
// they are stored as. Used by the Database tab (all institutions) and by
// the per-screen database sections (that persona's slice).

type DumpedInstitution = Awaited<
  ReturnType<typeof api.debug.dump.query>
>[number];

export function InstitutionDatabase({
  institution,
  stickyHeader = false,
}: {
  institution: DumpedInstitution;
  /** Pin the institution name to the viewport while its tables scroll.
   *  Only the Database tab wants this; inside a collapsible section the
   *  header would outstay its section. The header's pt-3 gives the
   *  pinned line an opaque strip that scrolling rows disappear under;
   *  the container's -mt-3 cancels it in the static layout — it cannot
   *  sit on the header itself, where a negative margin would shift the
   *  stuck position above the viewport. */
  stickyHeader?: boolean;
}) {
  return (
    <div className={`mb-7 last:mb-0 ${stickyHeader ? '-mt-3' : ''}`}>
      <div
        className={`mb-3 border-b border-line pb-1.5 text-xs font-semibold tracking-wider text-muted uppercase ${
          stickyHeader ? 'sticky top-0 z-10 bg-page pt-3' : ''
        }`}
      >
        {institution.institution}
      </div>
      {institution.tables.map(table => (
        <div key={table.name} className="mb-4 last:mb-0">
          <div className="mb-1.5 font-mono text-xs font-semibold">
            {table.name}
          </div>
          <div className="overflow-x-auto rounded-lg border border-line bg-surface">
            <table className="w-full border-collapse font-mono text-xs tabular-nums">
              <thead>
                <tr className="bg-faint">
                  {table.columns.map(column => (
                    <th
                      key={column}
                      className="border-b border-line px-3 py-1.5 text-left font-normal whitespace-nowrap text-muted"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={table.columns.length}
                      className="px-3 py-1.5 text-muted italic"
                    >
                      0 rows
                    </td>
                  </tr>
                ) : (
                  table.rows.map((row, index) => (
                    // The last *row* drops its divider (the container
                    // border closes the table), never the last column.
                    <tr key={index} className="last:*:border-b-0">
                      {row.map((value, column) => (
                        <td
                          key={column}
                          className="border-b border-line px-3 py-1 whitespace-nowrap"
                        >
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
