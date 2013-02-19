(function ($, undefined) {

Drupal.behaviors.wysiwygToolbarDesigner = {
  attach: function (context, settings) {
    var settings = settings.wysiwyg_toolbar;
    $('#edit-toolbar').parent().parent().hide();
    if (!settings.buttons || settings.buttons.length == 0) {
      return;
    }
    // Insert toolbar designer.
    $('#edit-plugins').after(Drupal.theme('toolbar_designer', settings));
    var workspace = $('#wysiwyg-toolbar-designer');
    var designArea = $('#toolbar-rows');
    var changeNotification = $('#wysiwyg-toolbar-designer div.toolbar-changed-warning');
    var availableButtons = $('#toolbar-available-buttons');

    // Set up sortables.
    $('.wysiwyg-button',availableButtons).addClass('template-button').draggable({
      handle: '.handler',
      helper: 'clone',
      connectToSortable: '.toolbar-group',
      revert: 'invalid',
      addClasses: false,
      start: function(event, ui) {
        // Workaround for jQuery UI bug fixed in version 1.8.11.
        // @see http://bugs.jqueryui.com/ticket/5811
        $('#toolbar-rows .toolbar-group').sortable('refreshPositions');
      }
    });

    availableButtons.droppable({
      accept: '.toolbar-button, .toolbar-group, .toolbar-row',
      drop: function(event, ui) {
        var item = ui.draggable;
        var parent = item.parent();

        // Guarantee there is at least 1 row and 1 group.
        if (item.hasClass('toolbar-row') && parent.find('.toolbar-row').not('.ui-sortable-placeholder').length == 1) {
          return;
        } else if (item.hasClass('toolbar-group') && parent.find('.toolbar-group').not('.ui-sortable-placeholder').length == 1) {
          return;
        }

        var buttons = $('.toolbar-button', item);
        if (item.hasClass('toolbar-button')) {
          buttons = buttons.add(item);
        }

        // Remove each button and enable in template.
        buttons.each(function(){
          var $button = $(this);
          $('.wysiwyg-button[data-plugin="' + $button.attr('data-plugin')  + '"][data-button="' + $button.attr('data-button')  + '"]').show();
        });

        item.parent().sortable('refresh');
        item.remove();
        changeNotification.fadeIn();
      }
    });

    $('#toolbar-rows').sortable({
      items: '.toolbar-row',
      handle: '.row-handler',
      addClass: false,
      stop: updateToolbarTextarea,
    });

    // Design actions buttons.
    $('.add-toolbar-row',workspace).click(function(){
      // Clone from toolbar template.
      var row = createRow();

      // Append row to design area.
      designArea.append(row).sortable('refresh');
      changeNotification.fadeIn();
      return false;
    });

    $('#reset-design').click(function() {
      if (!changeNotification.is(':hidden') && confirm(Drupal.t('Do you want to reset the changes ?')))
        reset();
      return false;
    });

    if (!settings['toolbar rows']) {
      $('.add-toolbar-row').hide();
    }

    reset();

    function createRow (noGroup) {
      var row = $('.toolbar-row-template',workspace).clone().removeClass('toolbar-row-template');
      row.addClass('toolbar-row').sortable({
        handle: '.group-handler',
        revert: true,
        items: '.toolbar-group',
        addClasses: false,
        connectWith: '#toolbar-rows .toolbar-row',
        receive: function(event, ui) {
          // ui.sender is posibly the available button which was cloned and
          // and dragged to this group. Separators can be used multiple times.
          if (ui.sender.hasClass('template-button') && !ui.sender.attr('data-multiple-instances')) {
            ui.sender.hide();
          }
        },
        stop: updateToolbarTextarea
      });
      if (settings['toolbar groups']) {
        row.find('.add-group').click(function() {
          var group = createGroup();
          row.append(group);
          row.sortable('refresh');
          changeNotification.fadeIn();
          return false;
        });
      }
      else {
        row.find('.add-group').hide();
        row.addClass('single-group');
      }
      // Add required group.
      if (!noGroup) {
        var group = createGroup();
        row.append(group);
      }
      return row;
    };

    function createGroup () {
      var group = $('.toolbar-group-template').clone().removeClass('toolbar-group-template');
      group.addClass('toolbar-group');
      group.sortable({
        revert: true,
        items: '.wysiwyg-button',
        connectWith: '#toolbar-rows .toolbar-group',
        addClasses: false,
        stop: updateToolbarTextarea,
        beforeStop: function(event, ui) {
          // ui.item is the clone of an available button dragged to this group.
          ui.item.removeClass('template-button').addClass('toolbar-button');
        },
        receive: function(event, ui) {
          // ui.sender is posibly the available button which was cloned and
          // and dragged to this group. Separators can be used multiple times.
          if (ui.sender.hasClass('template-button') && !ui.sender.attr('data-multiple-instances')) {
            ui.sender.hide();
          }
        }

      });
      return group;
    }

    function reset () {
      $('.toolbar-row',designArea).remove();
      // Enable all buttons and then disable it later.
      $('.wysiwyg-button',availableButtons).show();

      var rows = (settings['toolbar rows'] || !settings.toolbar ? settings.toolbar : [settings.toolbar]);
      for (var i in rows) {
        var row = createRow(true);
        var groups = (settings['toolbar groups'] ? rows[i] : [rows[i]]);
        for (var j in groups) {
          var group = createGroup();
          var buttons = groups[j];

          for (var k in buttons) {
            var buttonInfo = settings.buttons[buttons[k]];
            var template_button = $('.wysiwyg-button[data-plugin="' + buttonInfo.plugin + '"][data-button="' + buttons[k] + '"]', availableButtons);
            if (template_button.length) {
              button = template_button.clone().show();
              button.removeClass('template-button').addClass('toolbar-button');
              group.append(button);

              if (!buttonInfo.multiple) {
                // Disable button in template area.
                template_button.hide();
              }
            }
          }
          row.append(group);
        }
        designArea.append(row);
      }
      // Make sure we always have at least one row.
      if ($('.toolbar-row',designArea).length <= 0) {
        var row = createRow();
        designArea.append(row);
      }
      changeNotification.fadeOut();
    }

    function updateToolbarTextarea(event, ui) {
      // Prepare toolbar data to submit.
      var toolbar = [];
      designArea.find('.toolbar-row').each(function (key, rowDom){
        var row = [];
        $('.toolbar-group',rowDom).each(function (key, groupDom){
          var group = [];
          $('.wysiwyg-button',groupDom).each( function(key, button){
            group.push($(button).attr('data-button'));
          })
          if (settings['toolbar groups']) {
            row.push(group);
          }
          else {
            row = group;
          }
        });
        if (settings['toolbar rows']) {
           toolbar.push(row);
        }
        else {
          toolbar = row;
        }
      });
      // Assign to hidden field.
      $('#edit-toolbar').val(JSON.stringify(toolbar));
      changeNotification.fadeIn();
    }
  }
};

Drupal.theme.prototype.toolbar_designer = function (settings) {
  var markup = '<div id="wysiwyg-toolbar-designer">';
  markup += '<div id="toolbar-available-buttons"><label for="toolbar-available-buttons">' + Drupal.t('Available buttons') + '</label>';
  for (var button_name in settings.buttons) {
    var button = settings.buttons[button_name];
    markup += '<span class="wysiwyg-button" data-plugin="' + button.plugin + '" data-button="' + button_name
      + (button.multiple ? '" data-multiple-instances="yes"' : '')
      + '">' + Drupal.checkPlain(button.title) + '</span>';
  }
  markup += '</div><div id="stage"><label for="stage">' + Drupal.t('Toolbar') + '</label>'
    + '<div id="tolbar-description">' + Drupal.t('Drag any buttons you need from the area above into the toolbar layout below. Drag any item back to the area above to remove them from the toolbar layout.') + '</div>'
    + '<div id="toolbar-rows"></div>'
    + '<div id="toolbar-actions">'
      + '<a href="#" class="add add-toolbar-row">' + Drupal.t('Add new row') + '</a>'
    + '</div>'
    + '<div class="toolbar-row-template">'
      + '<a href="javascript:;" class="row-handler handler">&nbsp;</a>'
      + '<a href="javascript:;" class="add add-group">&nbsp;</a>'
    + '</div>'
    + '<div class="toolbar-group-template">'
      + '<a href="javascript:;" class="group-handler handler">&nbsp;</a>'
    + '</div>'
  + '</div>'
  + '<div class="toolbar-changed-warning messages warning"><span class="warning">*</span>'
    + Drupal.t('Changes made to this toolbar will not be saved until the form is submitted.') + '</div>';
  return markup;
}

})(jQuery);
