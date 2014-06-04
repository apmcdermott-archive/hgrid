/**
 * hgrid-draggable - Drag and drop support for HGrid
 *
 * Depends on hgrid-rowmovemanager.js and hgrid-rowselectionmodel.js.
 */
this.Draggable = (function($, HGrid) {
  'use strict';

  /**
   * Default options for the Slick.RowMoveManager constructor
   * @type {Object}
   */
  var rowMoveManagerDefaults = {
    cancelEditOnDrag: true
  };

  /**
   * Default options for Draggable constructor
   * @type {Object}
   */
  var defaults = {
    /*jshint unused: false */

    onMoved: function(event, movedItems, folder) {},
    onDrag: function(event, items) {},

    // Additional options passed to the Slick.RowMoveManager constructor
    rowMoveManagerOptions: {}
  };

  /** Public interface **/

  /**
   * Constructor for the HGrid.Draggable plugin.
   *
   * NOTE: This should NOT invoke the `init` method because `init` will be invoked
   * when HGrid#registerPlugin is called.
   */
  function Draggable(options) {
    var self = this;
    self.options = $.extend({}, defaults, options);
    self.rowMoveManager = null;  // Initialized in init
    // The current drag target
    self._folderTarget = null;
  }

  // Initialization function called by HGrid#registerPlugin
  Draggable.prototype.init = function(grid) {
    var self = this;
    var data = grid.getData();
    var dataView = grid.getDataView();
    var slickgrid = grid.grid;

    // Set selection model
    slickgrid.setSelectionModel(new HGrid.RowSelectionModel());


    // Configure the RowMoveManager
    var rowMoveManagerOptions = $.extend(
      {}, rowMoveManagerDefaults, self.options.rowMoveManagerOptions
    );
    self.rowMoveManager = new HGrid.RowMoveManager(rowMoveManagerOptions);

    /** Callbacks **/

    var onBeforeMoveRows = function(event, data) {
      // Prevent moving row before or after itself
      for (var i = 0; i < data.rows.length; i++) {
        if (data.rows[i] === data.insertBefore || data.rows[i] === data.insertBefore - 1) {
          event.stopPropagation();
          return false;
        }
      }
    };

    // TODO(sloria): Test me

    /**
     * Callback executed when rows are moved and dropped into a new location
     * on the grid.
     * @param  {Event} event
     * @param  {Object} args  Object containing information about the event,
     *                        including insertBefore.
     */
    var onMoveRows = function (event, args) {
      var extractedRows = [];
      // indices of the moved rows
      var indices = args.rows;

      // The moved data items
      var movedItems = indices.map(function(rowIdx) {
        return dataView.getItemByIdx(rowIdx);
      });

      // ID of the folder to transfer the items to
      var parentID = self._folderTarget.id;
      // Copy the moved items, but change the parentID to the target folder's ID
      var newItems = movedItems.map(function(item) {
        var newItem = $.extend({}, item);
        newItem.parentID = parentID;
        // remove depth and _node properties
        // these will be set upon adding the item to the grid
        delete newItem.depth;
        delete newItem._node;
        return newItem;
      });


      for (var i = 0, item; item = newItems[i]; i++) {
        grid.removeItem(item.id);
      }

      grid.addItems(newItems);
      grid.removeHighlight();

      slickgrid.resetActiveCell();
      slickgrid.setSelectedRows([]);
      slickgrid.render();
      // invoke user-defined callback
      // TODO(sloria): add target folder as an argument
      self.options.onMoved.call(self, event, movedItems, self._folderTarget);
    };

    var onDragStart = function(event, dd) {
      var cell = slickgrid.getCellFromEvent(event);
      if (!cell) {
        return;
      }

      dd.row = cell.row;
      if (!data[dd.row]) {
        return;
      }

      if (Slick.GlobalEditorLock.isActive()) {
        return;
      }

      event.stopImmediatePropagation();

      var selectedRows = grid.getSelectedRows();

      if (!selectedRows.length || $.inArray(dd.row, selectedRows) === -1) {
        selectedRows = [dd.row];
        grid.setSelectedRows(selectedRows);
      }

      dd.rows = selectedRows;
      dd.count = selectedRows.length;
    };


    var onDragRows = function(event, args) {
      // set the current drag target
      var movedItems = args.items;
      // get the parent of the current item being dragged over
      var parent;
      if (args.insertBefore) {
        var insertItem = dataView.getItemByIdx(args.insertBefore);
        parent = grid.getByID(insertItem.parentID);
        self._folderTarget = parent;
        grid.addHighlight(self._folderTarget);
      }
      self.options.onDrag.call(self, event, args.items, parent);
    };

    self.rowMoveManager.onBeforeMoveRows.subscribe(onBeforeMoveRows);
    self.rowMoveManager.onMoveRows.subscribe(onMoveRows);
    self.rowMoveManager.onDragRows.subscribe(onDragRows);

    // Register the slickgrid plugin
    slickgrid.registerPlugin(self.rowMoveManager);

    slickgrid.onDragInit.subscribe(function(event) {
      // prevent grid from cancelling drag'n'drop by default
      event.stopImmediatePropagation;
    });

    slickgrid.onDragStart.subscribe(onDragStart);
  };

  Draggable.prototype.destroy = function() {
    this.rowMoveManager.destroy();
    HGrid.Col.Name.behavior = null;
  };

  HGrid.Draggable = Draggable;
  return Draggable;
}).call(this, jQuery, HGrid);
