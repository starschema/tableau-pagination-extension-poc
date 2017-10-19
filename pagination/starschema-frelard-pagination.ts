
export namespace starschema.frelard.pagination {

    export namespace wrap {
        export interface Column {
            dataType: "string" | "int" | "float" | "bool" | "date" | "date-time" | "spatial";
            fieldName: string;
            index: number;
            isReferenced: boolean;
        }

        export interface DataValue {
            formattedValue: string;
            // FROM THE DOCS: Contains the raw native value as a JavaScript type,
            // which is one of String, Number, Boolean, or Date.
            // (NOTE: Date values seem to appear as strings)
            value: any;
        }

        export interface DataTable {
            columns: Array<Column>;
            data: Array<Array<DataValue>>;
            // marksInfo: Array<MarkInfo>;

            isSummaryData: boolean;
            name: string;
            totalRowCount: number;

        }

        export interface Filter {
            fieldId: string;
            fieldName: string;
            filterType: "categorical" | "range" | "hierarchical" | "relative-date";
            worksheetName: string;
        }
    }

    export interface RangeFilterSetting<T> {
        kind: "range-filter-setting";
        max: T;
        min: T;
        nullOption: "null-values" | "non-null-values" | "all-values";
    }

    export interface CategoricalFilterSetting<T> {
        kind: "categorical-filter-setting";
        filterValues: Array<T>,
    }


    export type FilterSetting<T> = RangeFilterSetting<T> | CategoricalFilterSetting<T>;

    export interface MinMaxColumn<T> {
        source: string;
        name: string;
        index: number;
        valueType: "string" | "number" | "date";
        values: Array<T>;
        min: T;
        max: T;

        // adds a value to the column
        add(val: any);


    }


    export type DistinctValues = Array<MinMaxColumn<string | Date | number>>;



    export function getDistinctValues(table: wrap.DataTable): DistinctValues {

        let out: DistinctValues = [];

        // generate columns
        let cols: DistinctValues = table.columns.reduce(function (out, col: wrap.Column): DistinctValues {

            switch (col.dataType) {
                case "string":
                    out.push(new _MinMaxColumn<string>(
                        table.name, col.fieldName, col.index, "string", "", (v) => v.toString()
                    ));
                    break;

                case "date":
                case "date-time":
                    out.push(
                        new _MinMaxColumn<Date>(table.name, col.fieldName, col.index, "date", new Date(),
                            function (v: any): Date {
                                if (typeof v === "string") {
                                    return new Date(Date.parse(v.toString()));
                                }
                                if (typeof v === "number") {
                                    return new Date(v);
                                }
                                if (typeof v.getTime === "function") {
                                    return new Date(v);
                                }
                            }
                        ));
                    break;

                case "float":
                    out.push(new _MinMaxColumn<number>(
                        table.name, col.fieldName, col.index, "number", 0,
                        (v) => parseFloat(v.toString())
                    ));
                    break;

                case "int":
                    out.push(new _MinMaxColumn<number>(
                        table.name, col.fieldName, col.index, "number", 0,
                        (v) => parseInt(v.toString())
                    ));
                    break;
                default:
            }
            return out;
        }, out);


        let rows: DistinctValues = table.data.reduce(function (out: DistinctValues, row: Array<wrap.DataValue>): DistinctValues {
            out.forEach(function (col) {
                col.add(row[col.index].value);
            });
            return out;
        }, cols);


        return rows.map( r => { r.values.sort(); return r; });
    }


    type ColumnType = "string" | "number" | "date";

    class _MinMaxColumn<T> implements MinMaxColumn<T> {
        source: string;
        name: string;
        index: number;
        valueType: ColumnType;
        values: Array<T>;
        min: T;
        max: T;


        cache: { [s: string]: boolean };
        parser: (any) => T;


        public constructor(source: string, name: string, index: number, typ: ColumnType, defaultValue: T, parser: (v: any) => T) {
            this.index = index;
            this.valueType = typ;
            this.values = [];
            this.min = null;
            this.max = null;
            this.name = name;
            this.source = source;
            this.cache = {};
            this.parser = parser;
        }

        public add(val: any) {
            // if its already in the cache, ignore
            if (this.cache[val]) {
                return
            }


            this.cache[val] = true;
            let v: T = this.parser(val);

            this.values.push(v);

            if (this.max === null || v > this.max) this.max = v;
            if (this.min === null || v < this.min) this.min = v;
        }
    }


    // Creates a filter setting utility for a column by min/max
    export function toFilter<T>(pageCount: number, pageNumber:number, col:MinMaxColumn<T>):FilterSetting<T> {
        let len = col.values.length;
        // convert to array index size
        let pageSize = (len - 1) / pageCount;
        let pageStart = pageNumber * pageSize;
        let pageEnd = (pageNumber + 1) * pageSize;

        if (pageStart < 0) { pageStart = 0; }
        else if (pageStart > (len - 1)) { pageStart = len - 1; }

        pageStart = Math.floor(pageStart);
        pageEnd = Math.ceil(pageEnd);

        if (pageEnd < 0) { pageEnd = 0; }
        else if (pageEnd > (len - 1)) { pageEnd = len - 1; }

        console.log({pageStart, pageEnd});
        switch(col.valueType) {
            case "string":
                return {
                    kind: "categorical-filter-setting",
                    filterValues: col.values.slice(pageStart, pageEnd + 1),
                };

            case "number":
                return {
                  kind: "range-filter-setting",
                  min: col.values[pageStart],
                  max: col.values[pageEnd],
                  nullOption: "non-null-values",
                };

            case "date":
                return {
                    kind: "range-filter-setting",
                    min: col.values[pageStart],
                    max: col.values[pageEnd],
                    nullOption: "non-null-values",
                };
        }
    }
}
