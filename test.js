"use strict";

let pagination = require(
    "./pagination/starschema-frelard-pagination").starschema.frelard.pagination;

let cols = [
  {
    dataType    : "int",
    fieldName   : "A int",
    index       : 0,
    isReferenced: false
  },
  {
    dataType    : "float",
    fieldName   : "B float",
    index       : 1,
    isReferenced: false
  },
  {
    dataType    : "string",
    fieldName   : "C string",
    index       : 2,
    isReferenced: false
  },
  {
    dataType    : "date",
    fieldName   : "D date",
    index       : 3,
    isReferenced: false
  },
  {
    dataType    : "date-time",
    fieldName   : "D date-time",
    index       : 4,
    isReferenced: false
  }
];

let t = {
  name         : "XXX",
  totalRowCount: 1,
  columns      : cols,
  data         : [
    [
      {value          : 12,
        formattedValue: "12"
      },
      {value          : 12.5,
        formattedValue: "12.500"
      },
      {value          : "Hello world 1",
        formattedValue: "Hello world 1"
      },
      {value          : new Date(),
        formattedValue: "..."
      },
      {value          : new Date(),
        formattedValue: "..."
      }
    ],

    [
      {value          : 13,
        formattedValue: "12"
      },
      {value          : 18.5,
        formattedValue: "12.500"
      },
      {value          : "Hello world 2",
        formattedValue: "Hello world 2"
      },
      {value          : new Date(),
        formattedValue: "..."
      },
      {value          : new Date()  ,
        formattedValue: "..."
      }
    ],

    [
      {value          : 16,
        formattedValue: "12"
      },
      {value          : 13.5,
        formattedValue: "12.500"
      },
      {value          : "Hello world 3",
        formattedValue: "Hello world 3"
      },
      {value          : new Date(Date.parse("2017-10-19T22:07:49.177Z")),
        formattedValue: "..."
      },
      {value          : new Date(),
        formattedValue: "..."
      }
    ]
  ],
  isSummaryData: false

};

let o = pagination.getDistinctValues(t);
console.log(o.map((v) => [v.name, v.min, v.max, v.values]));

console.log(o.map(v => pagination.toFilter(2, 1, v)));
