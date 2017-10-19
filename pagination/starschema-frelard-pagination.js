"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var starschema;
(function (starschema) {
    var frelard;
    (function (frelard) {
        var pagination;
        (function (pagination) {
            function getDistinctValues(table) {
                var out = [];
                // generate columns
                var cols = table.columns.reduce(function (out, col) {
                    switch (col.dataType) {
                        case "string":
                            out.push(new _MinMaxColumn(table.name, col.fieldName, col.index, "string", "", function (v) { return v.toString(); }));
                            break;
                        case "date":
                        case "date-time":
                            out.push(new _MinMaxColumn(table.name, col.fieldName, col.index, "date", new Date(), function (v) {
                                if (typeof v === "string") {
                                    return new Date(Date.parse(v.toString()));
                                }
                                if (typeof v === "number") {
                                    return new Date(v);
                                }
                                if (typeof v.getTime === "function") {
                                    return new Date(v);
                                }
                            }));
                            break;
                        case "float":
                            out.push(new _MinMaxColumn(table.name, col.fieldName, col.index, "number", 0, function (v) { return parseFloat(v.toString()); }));
                            break;
                        case "int":
                            out.push(new _MinMaxColumn(table.name, col.fieldName, col.index, "number", 0, function (v) { return parseInt(v.toString()); }));
                            break;
                        default:
                    }
                    return out;
                }, out);
                var rows = table.data.reduce(function (out, row) {
                    out.forEach(function (col) {
                        col.add(row[col.index].value);
                    });
                    return out;
                }, cols);
                return rows.map(function (r) { r.values.sort(); return r; });
            }
            pagination.getDistinctValues = getDistinctValues;
            var _MinMaxColumn = (function () {
                function _MinMaxColumn(source, name, index, typ, defaultValue, parser) {
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
                _MinMaxColumn.prototype.add = function (val) {
                    // if its already in the cache, ignore
                    if (this.cache[val]) {
                        return;
                    }
                    this.cache[val] = true;
                    var v = this.parser(val);
                    this.values.push(v);
                    if (this.max === null || v > this.max)
                        this.max = v;
                    if (this.min === null || v < this.min)
                        this.min = v;
                };
                return _MinMaxColumn;
            }());
            // Creates a filter setting utility for a column by min/max
            function toFilter(pageCount, pageNumber, col) {
                var len = col.values.length;
                // convert to array index size
                var pageSize = (len - 1) / pageCount;
                var pageStart = pageNumber * pageSize;
                var pageEnd = (pageNumber + 1) * pageSize;
                if (pageStart < 0) {
                    pageStart = 0;
                }
                else if (pageStart > (len - 1)) {
                    pageStart = len - 1;
                }
                pageStart = Math.floor(pageStart);
                pageEnd = Math.floor(pageEnd);
                if (pageEnd < 0) {
                    pageEnd = 0;
                }
                else if (pageEnd > (len - 1)) {
                    pageEnd = len - 1;
                }
                console.log({ pageStart: pageStart, pageEnd: pageEnd });
                switch (col.valueType) {
                    case "string":
                        return {
                            kind: "categorical-filter-setting",
                            filterValues: col.values.slice(pageStart, pageEnd),
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
            pagination.toFilter = toFilter;
        })(pagination = frelard.pagination || (frelard.pagination = {}));
    })(frelard = starschema.frelard || (starschema.frelard = {}));
})(starschema = exports.starschema || (exports.starschema = {}));
