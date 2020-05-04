import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback
} from "react";
import { FormCheck, Table } from "react-bootstrap";
import nanoid from "nanoid";
import axios, { Method } from "axios";

import { useApiGet } from "../../api/hooks";
import { APIError, Pagination } from "../types";

/**
 * RichTable describes a component that displays tabular data in an interactive manner. It defines two main exports:
 *
 * - useRichTable, a React hook for creating rich tables.
 * - RichTable, a React component to effortlessly insert a rich table.
 *
 * The interface is inspired by react-table.
 */

/**
 * First, we must introduce some basic types.
 */

export type Accessor<D extends object> = (row: D) => any;

export interface ColumnProps<D extends object = {}> {
  Header: string;
  sortable?: boolean;
  render?: (
    cell: any,
    row: D
  ) => React.ReactElement | React.ReactText | React.ReactFragment;
}

export type Column<D extends object = {}> = ColumnProps<D> &
  (
    | {
        key: keyof D & string;
        accessor?: undefined;
      }
    | {
        key: string;
        accessor: keyof D | Accessor<D>;
      }
  );

export interface PropsBag {
  key: any;
  [k: string]: any;
}

/**
 * Rich tables are completely self-contained, and so in order for external users to interact with and manipulate the
 * data, we introduce actions. Crucially, actions can be triggered only through user interaction with the table. This
 * means that the table cannot be manipulated through side effects.
 */

interface BaseAction {
  name: string;
  displayName?: string;
  triggers?: "click"[];
}

export type Action<D extends object = {}> = BaseAction &
  (
    | {
        bulk: true;
        call: (bag: RichTableBag<D>, rows: D[]) => Promise<any>;
      }
    | {
        bulk: false;
        call: (bag: RichTableBag<D>, row: D) => Promise<any>;
      }
    | {
        call: (bag: RichTableBag<D>) => Promise<any>;
      }
  );

/**
 * Here are the main types used to interact with RichTable.
 *
 * - RichTableCell and RichTableRow are self-explanatory.
 * - RichTableProps defines the props to pass into useRichTable or RichTable.
 * - RichTableBag contains all the data and methods required to construct a table. It is inspired by the Formik bag.
 */

export interface RichTableCell {
  useCellProps: () => PropsBag;
  render: () => React.ReactElement | React.ReactText | React.ReactFragment;
}

export interface RichTableRow<D extends object> {
  useRowProps: () => PropsBag;
  data: D;
  cells: RichTableCell[];
  isSelected: boolean;
  setSelected: (s: boolean) => void;
}

export interface RichTableProps<D extends object = {}> {
  columns: Column<D>[];
  url: string;
  pk: keyof D & string;
  paginated: boolean;
  getFreshOnClick?: boolean;
  actions?: Action<D>[];
  searchable?: boolean;
  selectable?: boolean;
}

export interface RichTableBag<D extends object = {}> {
  error: APIError | undefined;
  header: RichTableRow<{}>;
  rows: RichTableRow<D>[];
  page: number;
  numPages: number;
  setPage: (page: number) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  totalCount: number;
  executeAction: (name: string) => Promise<any>;
  makeRequest: (method: Method, row?: D, data?: any) => Promise<any>;
}

/**
 * Here, we define useRichTable, the main hook used to construct a rich table. It handles all data-related aspects; the
 * only way to interact with the data externally is through
 */
const useRichTable = <D extends object = {}>({
  columns,
  url,
  pk,
  paginated,
  actions = [],
  searchable,
  selectable
}: RichTableProps<D>): RichTableBag<D> => {
  const id = useRef(nanoid());
  const [sortColumn, setSortColumn] = useState<[string, boolean] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  // Trigger refreshes by toggling this state.
  // Named cuckoo because it reminds me of cuckoo hashing.
  const [cuckooLoad, setCuckoo] = useState(false);

  const dataUrl = useMemo<string>(
    () => {
      let queryBuilder: Array<[string, any]> = [["time", Date.now()]];
      if (paginated) {
        queryBuilder.push(["page", page]);
      }
      if (searchQuery) {
        queryBuilder.push(["search", searchQuery]);
      }
      if (sortColumn !== null) {
        queryBuilder.push(["sort", (sortColumn[1] ? "" : "-") + sortColumn[0]]);
      }
      return `${url}${queryBuilder.length ? "?" : ""}${queryBuilder
        .map(q => q.join("="))
        .join("&")}`;
    },
    // We can ignore the warning about cuckooLoad being an unnecessary dependency, since it exists to trigger
    // refreshing without changing other state.
    [url, paginated, sortColumn, searchQuery, page, cuckooLoad]
  );
  const [rawData, error] = useApiGet<Pagination<D> | D[]>(dataUrl);
  const data = useMemo<D[]>(
    () =>
      (paginated ? (rawData as Pagination<D>)?.results : (rawData as D[])) ||
      [],
    [paginated, rawData]
  );
  const numPages = paginated ? (rawData as Pagination<D>)?.num_pages || 0 : 0;
  const totalCount = paginated
    ? (rawData as Pagination<D>)?.count || 0
    : data.length;

  const selectAllRef = useRef<HTMLInputElement & FormCheck>(null);
  const [selected, setSelected] = useState<boolean[]>([]);

  useEffect(() => {
    setSelected(new Array(data.length).fill(false));
  }, [data.length]);
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        !selected.every(d => d) && selected.some(d => d);
    }
  }, [selected]);

  const clickActions = useMemo<Action<D>[]>(
    () =>
      actions.filter(
        action => action.triggers && action.triggers.includes("click")
      ),
    [actions]
  );

  const memoizedActions = useMemo<{ [key: string]: Action<D> }>(
    () => ({
      refresh: {
        name: "refresh",
        displayName: "Refresh",
        call() {
          setCuckoo(cuckoo => !cuckoo);
          return Promise.resolve();
        }
      },
      ...actions.reduce(
        (acc, action) => ({ ...acc, [action.name]: action }),
        {}
      )
    }),
    [actions]
  );

  const internalExecuteAction = useCallback(
    (name: string, rows: D[]) => {
      const action = memoizedActions[name];

      if ("bulk" in action) {
        if (action.bulk) {
          return action.call(bag, rows);
        } else {
          if (rows.length === 1) {
            return action.call(bag, rows[0]);
          } else {
            return Promise.reject(
              "Multiple rows selected for non-bulk action."
            );
          }
        }
      } else if (!("bulk" in action)) {
        return action.call(bag);
      }

      return Promise.resolve();
    },
    // We can ignore the warning about bag being a missing dependency -- although this technically depends on
    // it, both depend on data and so will refresh appropriately.
    [data, memoizedActions]
  );

  const executeAction = useCallback(
    (name: string) => {
      if (selected.some(d => d)) {
        const filteredSelected = data.filter((_, i) => selected[i]);
        return internalExecuteAction(name, filteredSelected);
      }

      return Promise.resolve();
    },
    [selected, data, internalExecuteAction]
  );

  const header = useMemo<RichTableRow<{}>>(() => {
    const onSelectAll = () => {
      if (selectAllRef.current) {
        setSelected(prevSelected =>
          new Array(data.length).fill(!prevSelected.some(d => d))
        );
      }
    };

    let cells: RichTableCell[] = columns.map(({ Header, key, sortable }) => {
      let props: PropsBag = { key };

      if (sortable) {
        props.onClick = () => {
          if (sortColumn === null || sortColumn[0] !== key) {
            setSortColumn([key, true]);
          } else {
            if (sortColumn[1]) {
              setSortColumn([key, false]);
            } else {
              setSortColumn(null);
            }
          }
        };
      }

      return {
        useCellProps() {
          return props;
        },
        render() {
          return `${Header}${
            sortColumn && sortColumn[0] === key
              ? sortColumn[1]
                ? "a"
                : "d"
              : ""
          }`;
        }
      };
    });

    if (selectable) {
      cells.unshift({
        useCellProps() {
          return {
            key: "select-all",
            className: "RichTable_selectCheckbox"
          };
        },
        render() {
          return (
            <FormCheck
              custom
              label={""}
              type="checkbox"
              aria-label="select all"
              id={`RichTable-${id.current}-select-all`}
              checked={selected.length > 0 && selected.every(d => d)}
              onChange={onSelectAll}
              ref={selectAllRef}
            />
          );
        }
      });
    }

    return {
      useRowProps() {
        return { key: "header" };
      },
      data: {},
      cells,
      isSelected: false,
      setSelected() {}
    };
  }, [columns, selected, sortColumn, selectable, data.length]);

  const rows = useMemo<RichTableRow<D>[]>(() => {
    return data.map((row, i) => {
      let props: PropsBag = { key: i };

      let cells: RichTableCell[] = columns.map(({ key, accessor, render }) => {
        const cell = accessor
          ? typeof accessor === "function"
            ? accessor(row)
            : row[accessor]
          : row[key as keyof D];

        return {
          useCellProps() {
            return { key };
          },
          render() {
            return render ? render(cell, row) : cell;
          }
        };
      });

      if (clickActions.length) {
        props.onClick = (e: React.MouseEvent) => {
          if (
            !(e.target as Element)
              .closest("td")
              ?.classList.contains("RichTable_selectCheckbox")
          ) {
            clickActions.forEach(action => {
              internalExecuteAction(action.name, [row]);
            });
          }
        };
      }

      const selectRow = () => {
        setSelected(prevSelected => {
          prevSelected[i] = !prevSelected[i];
          return prevSelected.slice();
        });
      };

      if (selectable) {
        cells.unshift({
          useCellProps() {
            return {
              key: "select-row",
              className: "RichTable_selectCheckbox"
            };
          },
          render() {
            return (
              <FormCheck
                custom
                label={""}
                type="checkbox"
                aria-label="select row"
                id={`RichTable-${id.current}-select-row-${i}`}
                checked={selected[i] || false}
                onChange={selectRow}
              />
            );
          }
        });
      }

      return {
        useRowProps() {
          return props;
        },
        data: row,
        cells,
        isSelected: selected[i],
        setSelected: selectRow
      };
    });
  }, [
    columns,
    data,
    selected,
    selectable,
    clickActions,
    internalExecuteAction
  ]);

  const makeRequest = (method: Method, row?: D, requestData?: any) => {
    let requestUrl = url;
    if (row !== null && row !== undefined) {
      requestUrl = `${url}/${row[pk]}`;
    }

    return axios(requestUrl, {
      method,
      data: requestData
    });
  };

  const bag: RichTableBag<D> = {
    error,
    header,
    rows,
    page,
    numPages,
    setPage,
    totalCount,
    searchQuery,
    setSearchQuery,
    executeAction,
    makeRequest
  };

  return bag;
};

const RichTable = <D extends object = {}>(config: RichTableProps<D>) => {
  const { header, rows } = useRichTable(config);

  return (
    <Table striped hover>
      <thead>
        <tr>
          {header.cells.map(cell => (
            <th {...cell.useCellProps()}>{cell.render()}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr {...row.useRowProps()}>
            {row.cells.map(cell => (
              <td {...cell.useCellProps()}>{cell.render()}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </Table>
  );
};

export default RichTable;
