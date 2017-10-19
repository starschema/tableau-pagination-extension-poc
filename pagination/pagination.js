"use strict";

// Wrap everything in an anonymous function to avoid poluting the global
// namespace
(function() {
  let unregisterHandlerFunctions = [];

  let step_count      = 16;
  let current_page    = 0;
  let selected_filter = {
    field_name: "Order Date",
    kind      : "date",
    min       : 0,
    max       : 1000,
    is_dummy  : true
  };

  let is_playing = false;

  function update_selected_filter_field(sf) {

    // remove if not dummy
    if (!selected_filter.is_dummy) {
      let old         = selected_filter;
      const dashboard = tableau.extensions.dashboardContent.dashboard;

      // Then loop through each worksheet and get its filters, save promise for
      // later.
      dashboard.worksheets.forEach(function(worksheet) {
        // restore old filter for field
        worksheet.applyRangeFilterAsync(old.field_name,
                                        {min: old.min, max: old.max});
      });
    }

    // set new as a copy
    selected_filter = Object.assign({}, sf);


    // display the field name
    $("#field-name").text(selected_filter.field_name);
  }

  function change_selected_filter_page(new_page) {
    let sf = selected_filter;

    // create ranges
    let step_size = (sf.max - sf.min) / step_count;
    // clip
    if (new_page >= step_count) { new_page = step_count - 1; }
    else if (new_page < 0) { new_page = 0; }

    if (!sf.is_dummy) {

      // create bounds
      let min = sf.min + (new_page * step_size);
      let max = sf.min + ((new_page + 1) * step_size);

      if (sf.kind === 'date') {
        min = new Date(min);
        max = new Date(max);
      }

      /// apply
      const dashboard = tableau.extensions.dashboardContent.dashboard;

      // Then loop through each worksheet and get its filters, save promise for
      // later.
      dashboard.worksheets.forEach(function(worksheet) {
        // restore old filter for field
        worksheet.applyRangeFilterAsync(sf.field_name, {min: min, max: max});
      });
    }

    current_page = new_page;

    // update the counter
    $("#current-page").text(new_page);
  }

  function hook_pagination_handler() {



    function onNext() {
      change_selected_filter_page(current_page + 1);
    }

    function onPrev() {
      change_selected_filter_page(current_page - 1);
    }

    $("#next-value").click(onNext);
    $("#prev-value").click(onPrev);

    $('#page-count').on('change', function(){
      let v = parseInt(this.value);
      if (v) {
        if (v < 1) v = 1;
        if (v > 128) v = 128;

        step_count = v;
        change_selected_filter_page(current_page);
      }
    });


    $("#should-autoplay").on('change', function() {

      // negate
      is_playing = !is_playing;

      // event handler

      if (is_playing) {
        setTimeout(on_tick, 25);
      }


    });


    function on_tick(){


      change_selected_filter_page((current_page + 1) % step_count);



      if (is_playing) {
        setTimeout(on_tick, 750);
      }

    }


  }





  $(document).ready(function() {
    tableau.extensions.initializeAsync().then(function() {
      //update_selected_filter_field({
      //                               field_name: "Order Date",
      //                               min       : 1388707200000,
      //                               max       : 1488707200000,
      //                               kind      : "date"
      //                             });
      fetchFilters();


      hook_pagination_handler();
      // Add button handlers for clearing filters.
      //$("#clear").click(clearAllFilters);
    }, function(err) {
      // Something went wrong in initialization.
      console.log("Error while Initializing: " + err.toString());
    });
  });

  function fetchFilters() {
    // While performing async task, show loading message to user.
    $("#loading").addClass("show");

    // Whenever we reste the filters table, remove all save handling functions,
    // since we add them back later in this function.
    unregisterHandlerFunctions.forEach(function(unregisterHandlerFunction) {
      unregisterHandlerFunction();
    });

    // Since filter info is attached to the worksheet, we will perform
    // one async call per worksheet to get every filter used in this
    // dashboard.  This demonstrates the use of Promise.all to combine
    // promises together and wait for each of them to resolve.
    let filterFetchPromises = [];

    // List of all filters in a dashboard.
    let dashboardfilters = [];

    // To get filter info, first get the dashboard.
    const dashboard = tableau.extensions.dashboardContent.dashboard;

    // Then loop through each worksheet and get its filters, save promise for
    // later.
    dashboard.worksheets.forEach(function(worksheet) {
      filterFetchPromises.push(worksheet.getFiltersAsync());

      // Add filter event to each worksheet.  AddEventListener returns a
      // function that will remove the event listener when called.
      //let unregisterHandlerFunction = worksheet.addEventListener(
      //    tableau.TableauEventType.FilterChanged, filterChangedHandler);

      let unregisterHandlerFunction = function() {};
      unregisterHandlerFunctions.push(unregisterHandlerFunction);
    });

    // Now, we call every filter fetch promise, and wait for all the results
    // to finish before displaying the results to the user.
    Promise.all(filterFetchPromises).then(function(fetchResults) {
      fetchResults.forEach(function(filtersForWorksheet) {
        filtersForWorksheet.forEach(function(filter) {
          dashboardfilters.push(filter);
        });
      });

      buildFiltersTable(dashboardfilters);
    });
  }

  //// This is a handling function that is called anytime a filter is changed in
  //// Tableau.
  //function filterChangedHandler(filterEvent) {
  //  // Just reconstruct the filters table whenever a filter changes.
  //  // This could be optimized to add/remove only the different filters.
  //  fetchFilters();
  //}

  // Contructs UI that displays all the dataSources in this dashboard
  // given a mapping from dataSourceId to dataSource objects.
  function buildFiltersTable(filters) {
    //$('#filters-dropdown > option').remove();
    let select = $("#filters-dropdown");

    let filter_done = {};
    //let opts= [];
    let FILTERS_DATA = {};
    let opts = filters.map(function(filter) {

      if (filter.filterType === "range") {
        let kind = "date";


        let filter_data = {
          field_name: filter.fieldName,
          min: new Date(filter.minValue.value).getTime(),
          max: new Date(filter.maxValue.value).getTime(),
          kind: kind,
          is_dummy: false,
        };


        // skip if we already did this
        if (filter_done[filter.field_name]) return "";


        filter_done[filter.field_name] = true;
        FILTERS_DATA[filter.fieldName] = filter_data;

        return `<option value="${filter.fieldName}" >${filter.fieldName}</option>`;
      }
      return '';
    });

    //select.off('change');
    select.html(
        `<option value='{field_name:"---", is_dummy: true, min: 0, max: 1, kind: "number"}'>---</option>` +
        opts.join(" "));

    select.on('change', function(){
      //$('.container').append(`<p>CHANGE!!!!</p>`);
      //let new_filter = filters[JSON.parse($(this).data('value'));
      //$('.container').append(`<p>CHANGE: ${this.value}</p>`);
      let filtersdatum = FILTERS_DATA[this.value];
      if (filtersdatum) {
        update_selected_filter_field(filtersdatum);
      }
    });

    // Clear the table first.
    //$("#filtersTable > tbody tr").remove();
    /*
    const filtersTable = $("#filtersTable > tbody")[0];

    filters.forEach(function(filter) {
      let newRow   = filtersTable.insertRow(filtersTable.rows.length);
      let nameCell = newRow.insertCell(0);
      //let worksheetCell = newRow.insertCell(1);
      //let typeCell = newRow.insertCell(2);
      //let valuesCell = newRow.insertCell(3);

      //const valueStr = getFilterValues(filter);

      //nameCell.innerHTML = filter.fieldName;
      let date_range_filter = date_range_filter_ui(16, filter, nameCell);
      if (date_range_filter) {
        //let newRow = filtersTable.insertRow(filtersTable.rows.length);
        //let nameCell = newRow.insertCell(0);
        nameCell.innerHTML = date_range_filter;

      }
      //worksheetCell.innerHTML = filter.worksheetName;
      //typeCell.innerHTML = filter.filterType;
      //valuesCell.innerHTML = valueStr;
    });
  */
    updateUIState(Object.keys(filters).length > 0);
  }

  // This returns a string representation of the values a filter is set to.
  // Depending on the type of filter, this string will take a different form.
  //function getFilterValues(filter) {
  //  let filterValues = "";
  //
  //  switch (filter.filterType) {
  //    case "categorical":
  //      filter.appliedValues.forEach(function(value) {
  //        filterValues += value.formattedValue + ", ";
  //      });
  //      break;
  //    case "range":
  //      // A range filter can have a min and/or a max.
  //      if (filter.minValue) {
  //        filterValues += "min: " + filter.minValue.formattedValue + ", ";
  //      }
  //
  //      if (filter.maxValue) {
  //        filterValues += "min: " + filter.maxValue.formattedValue + ", ";
  //      }
  //      break;
  //    case "relative-date":
  //      filterValues += "Period: " + filter.periodType + ", ";
  //      filterValues += "RangeN: " + filter.rangeN + ", ";
  //      filterValues += "Range Type: " + filter.rangeType + ", ";
  //      break;
  //    default:
  //      filterValues += "??? - " + JSON.stringify(filter);
  //  }
  //
  //  // Cut off the trailing ", "
  //  return filterValues.slice(0, -2);
  //}

  //// This function removes all filters from a dashboard.
  //function clearAllFilters() {
  //  // While performing async task, show loading message to user.
  //  $("#loading").removeClass("hidden").addClass("show");
  //  $("#filtersTable").removeClass("show").addClass("hidden");
  //
  //  const dashboard = tableau.extensions.dashboardContent.dashboard;
  //
  //  dashboard.worksheets.forEach(function(worksheet) {
  //    worksheet.getFiltersAsync().then(function(filtersForWorksheet) {
  //      let filterClearPromises = [];
  //
  //      filtersForWorksheet.forEach(function(filter) {
  //        filterClearPromises.push(
  //            worksheet.clearFilterAsync(filter.fieldName));
  //      });
  //
  //      // Same pattern as in fetchFilters, wait until all promises have
  //      // finished before updating the UI state.
  //      Promise.all(filterClearPromises).then(function() {
  //        updateUIState(false);
  //      });
  //    });
  //  });
  //}

  // This helper updates the UI depending on whether or not there are filters
  // that exist in the dashboard.  Accepts a boolean.
  function updateUIState(filtersExist) {
    $("#loading").addClass("hidden");
    //if (filtersExist) {
    //  $("#filtersTable").removeClass("hidden").addClass("show");
    //  $("#noFiltersWarning").removeClass("show").addClass("hidden");
    //} else {
    //  $("#noFiltersWarning").removeClass("hidden").addClass("show");
    //  $("#filtersTable").removeClass("show").addClass("hidden");
    //}
  }

//  function date_range_filter_ui(step_count, canvas) {
//    let filter = selected_filter;
//
//    if (filter.filterType !== "range") return "";
//
//    let min = filter.minValue.value;
//    let max = filter.maxValue.value;
//
//    let base = 0, step_size = 1, converter_kind = "date";
//
//    // if its a date
//    if (typeof min.getTime === "function") {
//      converter_kind = "date";
//      base           = min.getTime();
//      let step_range = max.getTime() - min.getTime();
//      step_size      = step_range / step_count;
//    }
//
//    return `
//<input type="checkbox" checked="" /><label>${converter_kind}: ${filter.fieldName}</label>
//<button class='next-value'>&larr;</button>
//<input type="number" min="2" max="16" class='page-number' value="0"/>
//<button class='prev-value'>&rarr;</button>
//
//<span >base=${base} -- step=${step_size}</span>
//`;
//
//  }
//

})();
