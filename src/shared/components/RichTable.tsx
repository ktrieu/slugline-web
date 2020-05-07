import "./RichTable.scss";

import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback
} from "react";
import {
  FormControl,
  FormCheck,
  Table,
  Row,
  Col,
  Button
} from "react-bootstrap";
import nanoid from "nanoid";
import axios, { Method } from "axios";

import { useApiGet } from "../../api/hooks";
import { APIError, Pagination } from "../types";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

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
  width?: number;
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
  selected: D[];
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
 * only way to interact with the data externally is through actions.
 */
const useRichTable = <D extends object = {}>({
  columns,
  url,
  pk,
  paginated,
  actions = [],
  selectable
}: RichTableProps<D>): RichTableBag<D> => {
  const id = useRef(nanoid());
  const [sortColumn, setSortColumn] = useState<[string, boolean] | null>(null);
  const [searchQuery, _setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  // Trigger refreshes by toggling this state.
  // Named cuckoo because it reminds me of cuckoo hashing.
  const [cuckooLoad, setCuckoo] = useState(false);

  const preSearchParams = useRef<{ page: number, sortColumn: [string, boolean] | null }>({
    page: 1,
    sortColumn: null
  });
  const setSearchQuery = (query: string) => {
    if (!searchQuery) {
      preSearchParams.current = {
        page,
        sortColumn
      };
    } else if (searchQuery && !query) {
      setPage(preSearchParams.current.page);
      setSortColumn(preSearchParams.current.sortColumn);
    }
    _setSearchQuery(query);
  };

  const dataUrl = useMemo<string>(
    () => {
      let queryBuilder: { [key: string]: string | number } = { time: Date.now() };
      if (paginated) {
        queryBuilder.page = page;
      }
      if (searchQuery) {
        queryBuilder.search = window.encodeURIComponent(searchQuery);
      }
      if (sortColumn !== null) {
        queryBuilder.sort = (sortColumn[1] ? "" : "-") + window.encodeURIComponent(sortColumn[0]);
      }
      return `${url}${Object.keys(queryBuilder).length ? "?" : ""}${Object.entries(queryBuilder)
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
  const [filteredSelected, setFilteredSelected] = useState<D[]>([]);

  useEffect(() => {
    setSelected(new Array(data.length).fill(false));
  }, [data]);
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        !selected.every(d => d) && selected.some(d => d);
    }
  }, [selected]);
  useEffect(() => {
    setFilteredSelected(data.filter((_, i) => selected[i]));
  }, [data, selected]);

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
      } else {
        return action.call(bag);
      }
    },
    // We can ignore the warning about bag being a missing dependency -- although this technically depends on
    // it, both depend on data and so will refresh appropriately.
    [data, memoizedActions]
  );

  const executeAction = useCallback(
    (name: string) => {
      if ("bulk" in memoizedActions[name] && filteredSelected.length) {
        return internalExecuteAction(name, filteredSelected);
      } else if (!("bulk" in memoizedActions[name])) {
        return internalExecuteAction(name, []);
      }

      return Promise.resolve();
    },
    [filteredSelected, memoizedActions, internalExecuteAction]
  );

  const header = useMemo<RichTableRow<{}>>(() => {
    const onSelectAll = () => {
      if (selectAllRef.current) {
        setSelected(prevSelected =>
          new Array(data.length).fill(!prevSelected.some(d => d))
        );
      }
    };

    let cells: RichTableCell[] = columns.map(({ Header, key, sortable, width }) => {
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

      if (width) {
        props.style = {
          width: `${width}%`
        };
      }

      return {
        useCellProps() {
          return props;
        },
        render() {
          return <span className="RichTable_cellHeader">
            {Header}
            {sortable &&
            <FontAwesomeIcon
              icon={(sortColumn && sortColumn[0] === key)
                ? (sortColumn[1]
                  ? "caret-up"
                  : "caret-down")
                : "sort"}
              className="ml-auto"
            />
            }
          </span>;
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
    if (!data.length) {
      return [
        {
          useRowProps() {
            return { key: 0 };
          },
          data: {} as D,
          cells: [{
            useCellProps() {
              return {
                key: 0,
                className: "RichTable_noRowsReturned text-center",
                colspan: columns.length + (selectable ? 1 : 0)
              }
            },
            render() {
              return "No rows returned."
            }
          }],
          isSelected: false,
          setSelected() {}
        }
      ]
    }
    return data.map((row, i) => {
      let props: PropsBag = { key: i };

      let cells: RichTableCell[] = columns.map(({ key, accessor, render }) => {
        const cell = accessor
          ? typeof accessor === "function"
            ? accessor(row)
            : row[accessor]
          : row[key as keyof D];
        let props: PropsBag = { key };

        return {
          useCellProps() {
            return props;
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
    selected: filteredSelected,
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

/**
 * The RichTable component, on the other hand, is a ready-to-use table with pagination, sorting, and search natively
 * supported.
 */
const RichTable = <D extends object = {}>(config: RichTableProps<D>) => {
  const {
    header,
    rows,
    selected,
    page,
    setPage,
    numPages,
    totalCount,
    setSearchQuery,
    executeAction,
  } = useRichTable(config);
  const debouncer = useRef<number>(-1);

  return (
    <div className="RichTable">
      <Row className="RichTable_header">
        {config.searchable && (
          <Col lg={3} className="RichTable_search">
            <FormControl
              type="text"
              placeholder="Search..."
              size="sm"
              className="RichTable_searchBox"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const value = e.currentTarget.value;
                window.clearTimeout(debouncer.current);
                if (value) {
                  debouncer.current = window.setTimeout(() => {
                    setSearchQuery(value);
                  }, 500);
                } else {
                  setSearchQuery("");
                }
              }}
            />
          </Col>
        )}
        {config.actions &&
          <Col lg={7} className="RichTable_actions">
            {config.actions.map((action) =>
              <Button
                key={action.name}
                variant="link"
                disabled={"bulk" in action && (selected.length === 0 || (!action.bulk && selected.length > 1))}
                onClick={() => {
                  executeAction(action.name);
                }}
              >
                {action.displayName ?? action.name}
              </Button>
            )}
          </Col>
        }
        {config.paginated && (
          <Col lg={2} className="RichTable_pagination ml-lg-auto justify-content-center justify-content-lg-end">
            <Button variant="link" disabled={page >= numPages}>
              <FontAwesomeIcon
                icon="chevron-left"
                className="RichTable_paginationIcon"
                onClick={() => {
                  if (page > 1) {
                    setPage(page - 1);
                  }
                }}
              />
            </Button>
            <span className="RichTable_paginationText">
              {page} / {numPages}
            </span>
            <Button variant="link" disabled={page >= numPages}>
              <FontAwesomeIcon
                icon="chevron-right"
                className="RichTable_paginationIcon"
                onClick={() => {
                  if (page < numPages) {
                    setPage(page + 1);
                  }
                }}
              />
            </Button>
          </Col>
        )}
      </Row>
      <Table striped hover className="RichTable_table">
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
      <Row className="RichTable_footer">
        <Col lg={3} className="d-none d-lg-flex RichTable_summary">
          Total count: {totalCount}
        </Col>
        {config.paginated && (
          <Col lg={3} className="ml-lg-auto text-sm-center text-lg-right">
            <Button variant="link" disabled={page >= numPages}>
              <FontAwesomeIcon
                icon="chevron-left"
                className="RichTable_paginationIcon"
                onClick={() => {
                  if (page > 1) {
                    setPage(page - 1);
                  }
                }}
              />
            </Button>
            <span className="RichTable_paginationText">
              {page} / {numPages}
            </span>
            <Button variant="link" disabled={page >= numPages}>
              <FontAwesomeIcon
                icon="chevron-right"
                className="RichTable_paginationIcon"
                onClick={() => {
                  if (page < numPages) {
                    setPage(page + 1);
                  }
                }}
              />
            </Button>
          </Col>
        )}
      </Row>
    </div>
  );
};

export default RichTable;
