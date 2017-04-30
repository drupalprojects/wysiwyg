(function($) {

// Check if this file has already been loaded.
if (typeof Drupal.wysiwygAttach !== 'undefined') {
  return;
}

// Keeps track of editor status during AJAX operations, active format and more.
// Always use getFieldInfo() to get a valid reference to the correct data.
var _fieldInfoStorage = {};
// Keeps track of information relevant to each format, such as editor settings.
// Always use getFormatInfo() to get a reference to a format's data.
var _formatInfoStorage = {};

// Keeps track of global and per format plugin configurations.
// Always use getPluginInfo() tog get a valid reference to the correct data.
var _pluginInfoStorage = {'global': {'drupal': {}, 'native': {}}};

// Keeps track of private instance information.
var _internalInstances = {};

// Keeps track of initialized editor libraries.
var _initializedLibraries = {};

// Keeps a map between format selectboxes and fields.
var _selectToField = {};

/**
 * Returns field specific editor data.
 *
 * @throws Error
 *   Exception thrown if data for an unknown field is requested.
 *
 * If a field id contains the delimiter '--', anything after that is dropped and
 * the remainder is assumed to be the id of an original field replaced by an
 * AJAX operation, due to how Drupal generates unique ids.
 * @see drupal_html_id()
 *
 * Do not modify the returned object unless you really know what you're doing.
 * No external code should need access to this, and it may likely change in the
 * future.
 *
 * @param fieldId
 *   The id of the field to get data for.
 *
 * @returns
 *   A reference to an object with the following properties:
 *   - activeFormat: A string with the active format id.
 *   - enabled: A boolean, true if the editor is attached.
 *   - formats: An object with one sub-object for each available format, holding
 *     format specific state data for this field.
 *   - trigger: A string with the id of the format selector for the field.
 *   - getFormatInfo: Shortcut method to getFormatInfo(fieldInfo.activeFormat).
 */
function getFieldInfo(fieldId) {
  if (_fieldInfoStorage[fieldId]) {
    return _fieldInfoStorage[fieldId];
  }
  var baseFieldId = (fieldId.indexOf('--') === -1 ? fieldId : fieldId.substr(0, fieldId.indexOf('--')));
  if (_fieldInfoStorage[baseFieldId]) {
    return _fieldInfoStorage[baseFieldId];
  }
  throw new Error('Wysiwyg module has no information about field "' + fieldId + '"');
}

/**
 * Returns format specific editor data.
 *
 * Do not modify the returned object unless you really know what you're doing.
 * No external code should need access to this, and it may likely change in the
 * future.
 *
 * @param formatId
 *   The id of a format to get data for.
 *
 * @returns
 *   A reference to an object with the following properties:
 *   - editor: A string with the id of the editor attached to the format.
 *     'none' if no editor profile is associated with the format.
 *   - enabled: True if the editor is active.
 *   - toggle: True if the editor can be toggled on/off by the user.
 *   - editorSettings: A structure holding editor settings for this format.
 *   - getPluginInfo: Shortcut method to get plugin config for the this format.
 */
function getFormatInfo(formatId) {
  if (_formatInfoStorage[formatId]) {
    return _formatInfoStorage[formatId];
  }
  return {
    editor: 'none',
    getPluginInfo: function () {
      return getPluginInfo(formatId);
    }
  };
}

/**
 * Returns plugin configuration for a specific format, or the global values.
 *
 * @param formatId
 *   The id of a format to get data for, or 'global' to get data common to all
 *   formats and editors. Use 'global:editorname' to limit it to one editor.
 *
 * @return
 *   The returned object will have the sub-objects 'drupal' and 'native', each
 *   with properties matching names of plugins.
 *   Global data for Drupal (cross-editor) plugins will have the following keys:
 *   - title: A human readable name for the button.
 *   - internalName: The unique name of a native plugin wrapper, used in editor
 *     profiles and when registering the plugin with the editor API to avoid
 *     possible id conflicts with native plugins.
 *   - css: A stylesheet needed by the plugin.
 *   - icon path: The path where button icons are stored.
 *   - path: The path to the plugin's main folder.
 *   - buttons: An object with button data, keyed by name with the properties:
 *     - description: A human readable string describing the button's function.
 *     - title: A human readable string with the name of the button.
 *     - icon: An object with one or more of the following properties:
 *       - src: An absolute (begins with '/') or relative path to the icon.
 *       - path: An absolute path to a folder containing the button.
 *
 *   When formatId matched a format with an assigned editor, values for plugins
 *   match the return value of the editor integration's [proxy] plugin settings
 *   callbacks.
 *
 *   @see Drupal.wysiwyg.utilities.getPluginInfo()
 *   @see Drupal.wyswiyg.utilities.extractButtonSettings()
 */
function getPluginInfo(formatId) {
  var match, editor;
  if ((match = formatId.match(/^global:(\w+)$/))) {
    formatId = 'global';
    editor = match[1];
  }
  if (!_pluginInfoStorage[formatId]) {
    return {};
  }
  if (formatId === 'global' && typeof editor !== 'undefined') {
    return { 'drupal': _pluginInfoStorage.global.drupal, 'native': (_pluginInfoStorage.global['native'][editor]) };
  }
  return _pluginInfoStorage[formatId];
}

/**
 * Attach editors to input formats and target elements (f.e. textareas).
 *
 * This behavior searches for input format selectors and formatting guidelines
 * that have been preprocessed by Wysiwyg API. All CSS classes of those elements
 * with the prefix 'wysiwyg-' are parsed into input format parameters, defining
 * the input format, configured editor, target element id, and variable other
 * properties, which are passed to the attach/detach hooks of the corresponding
 * editor.
 *
 * Furthermore, an "enable/disable rich-text" toggle link is added after the
 * target element to allow users to alter its contents in plain text.
 *
 * This is executed once, while editor attach/detach hooks can be invoked
 * multiple times.
 *
 * @param context
 *   A DOM element, supplied by Drupal.attachBehaviors().
 */
Drupal.behaviors.attachWysiwyg = function(context) {
  // This breaks in Konqueror. Prevent it from running.
  if (/KDE/.test(navigator.vendor)) {
    return;
  }

  var wysiwygs = $('.wysiwyg:not(.wysiwyg-processed)', context);
  if (!wysiwygs.length) {
    // No new fields, nothing to update.
    return;
  }
  updateInternalState(Drupal.settings.wysiwyg, context);
  wysiwygs.each(function() {
    // Skip processing if the element is unknown or does not exist in this
    // document. Can happen after a form was removed but Drupal.ajax keeps a
    // lingering reference to the form and calls Drupal.attachBehaviors().
    var $this = $('#' + this.id, document);
    if (!$this.length) {
      return;
    }
    $this.addClass('wysiwyg-processed');
    // Directly attach this editor, if the input format is enabled or there is
    // only one input format at all.
    Drupal.wysiwygAttach(context, this.id);
  })
  // Detach any editor when the containing form is submitted.
  .parents('form').submit(function (event) {
    // Do not detach if the event was cancelled.
    if (event.originalEvent.returnValue === false || event.isDefaultPrevented()) {
      return;
    }
    var form = this;
    $('.wysiwyg:input', this).each(function () {
      Drupal.wysiwygDetach(form, this.id, 'serialize');
    });
  })
  // Sync editor contents back to the original textarea before AHAH events.
  // D6 Core's jqyery.form.js triggers 'form.pre.serialize' and the version
  // shipped with jQuery Update module triggers 'form-pre-serialize'.
  // The order in which the events are bound matters, form.pre.serialize only
  // fires if it is registered last.
  .bind('form-pre-serialize form.pre.serialize', function (ev, $form, ajax, other) {
    var wysiwygs = $form.find('.wysiwyg-processed:input');
    wysiwygs.each(function () {
      Drupal.wysiwygDetach(context, this.id, 'serialize');
    });
  });
};

/**
 * Attach an editor to a target element.
 *
 * Detaches any existing instance for the field before attaching a new instance
 * based on the current state of the field. Editor settings and state
 * information is fetched based on the element id and get cloned first, so they
 * cannot be overridden. After attaching the editor, the toggle link is shown
 * again, except in case we are attaching no editor.
 *
 * @param context
 *   A DOM element, supplied by Drupal.attachBehaviors().
 * @param fieldId
 *   The id of an element to attach an editor to.
 */
Drupal.wysiwygAttach = function(context, fieldId) {
  // Detach any previous editor instance if enabled, else remove the grippie.
  detachFromField(fieldId, context, 'unload');
  // Store this field id, so (external) plugins can use it.
  // @todo Wrong point in time. Probably can only supported by editors which
  //   support an onFocus() or similar event.
  Drupal.wysiwyg.activeId = fieldId;
  // Attach or update toggle link, if enabled.
  Drupal.wysiwygAttachToggleLink(context, fieldId);
  // Attach to main field.
  attachToField(fieldId, context);
};

/**
 * The public API exposed for an editor-enabled field.
 *
 * Properties should be treated as read-only state and changing them will not
 * have any effect on how the instance behaves.
 *
 * Note: The attach() and detach() methods are not part of the public API and
 * should not be called directly to avoid synchronization issues.
 * Use Drupal.wysiwygAttach() and Drupal.wysiwygDetach() to activate or
 * deactivate editor instances. Externally switching the active editor is not
 * supported other than changing the format using the select element.
 */
function WysiwygInstance(internalInstance) {
  // The id of the field the instance manipulates.
  this.field = internalInstance.field;
  // The internal name of the attached editor.
  this.editor = internalInstance.editor;
  // If the editor is currently enabled or not.
  this['status'] = internalInstance['status'];
  // The id of the text format the editor is attached to.
  this.format = internalInstance.format;
  // If the field is resizable without an editor attached.
  this.resizable = internalInstance.resizable;

  // Methods below here redirect to the 'none' editor which handles plain text
  // fields when the editor is disabled.

   /**
    * Insert content at the cursor position.
    *
    * @param content
    *   An HTML markup string.
    */
  this.insert = function (content) {
    return internalInstance['status'] ? internalInstance.insert(content) : Drupal.wysiwyg.editor.instance.none.insert.call(internalInstance, content);
  }

  /**
   * Get all content from the editor.
   *
   * @return
   *   An HTML markup string.
   */
  this.getContent = function () {
    return internalInstance['status'] ? internalInstance.getContent() : Drupal.wysiwyg.editor.instance.none.getContent.call(internalInstance);
  }

  /**
   * Replace all content in the editor.
   *
   * @param content
   *   An HTML markup string.
   */
  this.setContent = function (content) {
    return internalInstance['status'] ? internalInstance.setContent(content) : Drupal.wysiwyg.editor.instance.none.setContent.call(internalInstance, content);
  }

  /**
   * Check if the editor is in fullscreen mode.
   *
   * @return bool
   *  True if the editor is considered to be in fullscreen mode.
   */
  this.isFullscreen = function (content) {
    return internalInstance['status'] && $.isFunction(internalInstance.isFullscreen) ? internalInstance.isFullscreen() : false;
  }

  // @todo The methods below only work for TinyMCE, deprecate?

  /**
   * Open a native editor dialog.
   *
   * Use of this method i not recommended due to limited editor support.
   *
   * @param dialog
   *   An object with dialog settings. Keys used:
   *   - url: The url of the dialog template.
   *   - width: Width in pixels.
   *   - height: Height in pixels.
   */
  this.openDialog = function (dialog, params) {
    if ($.isFunction(internalInstance.openDialog)) {
      return internalInstance.openDialog(dialog, params)
    }
  }

  /**
   * Close an opened dialog.
   *
   * @param dialog
   *   Same options as for opening a dialog.
   */
  this.closeDialog = function (dialog) {
    if ($.isFunction(internalInstance.closeDialog)) {
      return internalInstance.closeDialog(dialog)
    }
  }
}

/**
 * The private base for editor instances.
 *
 * An instance of this object is used as the context for all calls into the
 * editor instances (including attach() and detach() when only one instance is
 * asked to detach).
 *
 * Anything added to Drupal.wysiwyg.editor.instance[editorName] is cloned into
 * an instance of this function.
 *
 * Editor state parameters are cloned into the instance after that.
 */
function WysiwygInternalInstance(params) {
  $.extend(true, this, Drupal.wysiwyg.editor.instance[params.editor]);
  $.extend(true, this, params);
  this.pluginInfo = {
    'global': getPluginInfo('global:' + params.editor),
    'instances': getPluginInfo(params.format)
  };
  // Keep track of the public face to keep it synced.
  this.publicInstance = new WysiwygInstance(this);
}

/**
 * Updates internal settings and state caches with new information.
 *
 * Attaches selection change handler to format selector to track state changes.
 *
 * @param settings
 *   A structure like Drupal.settigns.wysiwyg.
 * @param context
 *   The context given from Drupal.attachBehaviors().
 */
function updateInternalState(settings, context) {
  var pluginData = settings.plugins;
  for (var plugin in pluginData.drupal) {
    if (!(plugin in _pluginInfoStorage.global.drupal)) {
      _pluginInfoStorage.global.drupal[plugin] = pluginData.drupal[plugin];
    }
  }
  // To make sure we don't rely on Drupal.settings, uncomment these for testing.
  //pluginData.drupal = {};
  for (var editorId in pluginData['native']) {
    for (var plugin in pluginData['native'][editorId]) {
      _pluginInfoStorage.global['native'][editorId] = (_pluginInfoStorage.global['native'][editorId] || {});
      if (!(plugin in _pluginInfoStorage.global['native'][editorId])) {
        _pluginInfoStorage.global['native'][editorId][plugin] = pluginData['native'][editorId][plugin];
      }
    }
  }
  //pluginData['native'] = {};
  for (var fmatId in pluginData) {
    if (fmatId.substr(0, 6) !== 'format') {
      continue;
    }
    _pluginInfoStorage[fmatId] = (_pluginInfoStorage[fmatId] || {'drupal': {}, 'native': {}});
    for (var plugin in pluginData[fmatId].drupal) {
      if (!(plugin in _pluginInfoStorage[fmatId].drupal)) {
        _pluginInfoStorage[fmatId].drupal[plugin] = pluginData[fmatId].drupal[plugin];
      }
    }
    for (var plugin in pluginData[fmatId]['native']) {
      if (!(plugin in _pluginInfoStorage[fmatId]['native'])) {
        _pluginInfoStorage[fmatId]['native'][plugin] = pluginData[fmatId]['native'][plugin];
      }
    }
    delete pluginData[fmatId];
  }
  // Build the cache of format/profile settings.
  for (var editor in settings.configs) {
    if (!settings.configs.hasOwnProperty(editor)) {
      continue;
    }
    for (var format in settings.configs[editor]) {
      if (_formatInfoStorage[format] || !settings.configs[editor].hasOwnProperty(format)) {
        continue;
      }
      _formatInfoStorage[format] = {
        editor: editor,
        toggle: true, // Overridden by triggers.
        editorSettings: processObjectTypes(settings.configs[editor][format])
      };
    }
    // Initialize editor libraries if not already done.
    if (!_initializedLibraries[editor] && typeof Drupal.wysiwyg.editor.init[editor] === 'function') {
      // Clone, so original settings are not overwritten.
      Drupal.wysiwyg.editor.init[editor](jQuery.extend(true, {}, settings.configs[editor]), getPluginInfo('global:' + editor));
      _initializedLibraries[editor] = true;
    }
    // Update libraries, in case new plugins etc have not been initialized yet.
    else if (typeof Drupal.wysiwyg.editor.update[editor] === 'function') {
      Drupal.wysiwyg.editor.update[editor](jQuery.extend(true, {}, settings.configs[editor]), getPluginInfo('global:' + editor));
    }
  }
  //settings.configs = {};
  for (var triggerId in settings.triggers) {
    var trigger = settings.triggers[triggerId];
    var fieldId = trigger.field;
    var baseFieldId = (fieldId.indexOf('--') === -1 ? fieldId : fieldId.substr(0, fieldId.indexOf('--')));
    var fieldInfo = null;
    if ($('#' + triggerId, context).length === 0) {
      // Skip fields which may have been removed or are not in this context.
      continue;
    }
    if (!(fieldInfo = _fieldInfoStorage[baseFieldId])) {
      fieldInfo = _fieldInfoStorage[baseFieldId] = {
        formats: {},
        select: trigger.select,
        resizable: trigger.resizable,
        getFormatInfo: function () {
          if (this.select) {
            this.activeFormat = 'format' + $(':input[name="' + this.select + '"]').filter(':checked').val();
          }
          return getFormatInfo(this.activeFormat);
        }
        // 'activeFormat' and 'enabled' added below.
      };
    }
    for (var format in trigger) {
      if (format.indexOf('format') != 0 || fieldInfo.formats[format]) {
        continue;
      }
      fieldInfo.formats[format] = {
        'enabled': trigger[format].status
      };
      if (!_formatInfoStorage[format]) {
        _formatInfoStorage[format] = {
          editor: trigger[format].editor,
          editorSettings: {},
          getPluginInfo: function () {
            return getPluginInfo(formatId);
          }
        };
      }
      // Always update these since they are stored as state.
      _formatInfoStorage[format].toggle = trigger[format].toggle;
    }
    var $selectbox = null;
    // Always update these since Drupal generates new ids on AJAX calls.
    if (trigger.select) {
      _selectToField[trigger.select.replace(/--\d+$/,'')] = trigger.field;
      fieldInfo.select = trigger.select;
      $selectbox = $(':input[name="' + trigger.select + '"]', context);
      // Attach onChange handlers to input format selector elements.
      $selectbox.unbind('change.wysiwyg').bind('change.wysiwyg', formatChanged);
    }
    // Always update the active format to ensure the righ profile is used if a
    // field was removed and gets re-added and the instance was left behind.
    fieldInfo.activeFormat = 'format' + ($selectbox ? $selectbox.filter(':checked').val() : trigger.activeFormat);
    fieldInfo.enabled = fieldInfo.formats[fieldInfo.activeFormat] && fieldInfo.formats[fieldInfo.activeFormat].enabled;
  }
  //settings.triggers = {};
}

/**
 * Helper to prepare and attach an editor for a single field.
 *
 * Creates the 'instance' object under Drupal.wysiwyg.instances[fieldId].
 *
 * @param mainFieldId
 *  The id of the field's main element, for fetching field info.
 * @param context
 *   A DOM element, supplied by Drupal.attachBehaviors().
 * @param params
 *   An optional object for overriding state information for the editor with the
 *   following properties:
 *   - 'forceDisabled': Set to true to override the current state of the field
 *     and assume it is disabled. Useful for hidden instances.
 *
 * @see Drupal.wysiwygAttach()
 */
function attachToField(mainFieldId, context, params) {
  params = params || {};
  var fieldInfo = getFieldInfo(mainFieldId);
  // Summaries are not supported in D6.
  var fieldId = mainFieldId;
  var formatInfo = fieldInfo.getFormatInfo();
  // If the editor isn't active, attach default behaviors instead.
  var enabled = (fieldInfo.enabled && !params.forceDisabled);
  var editor = (enabled ? formatInfo.editor : 'none');
  // Settings are deep merged (cloned) to prevent editor implementations from
  // permanently modifying them while attaching.
  var clonedSettings = (enabled ? jQuery.extend(true, {}, formatInfo.editorSettings) : {});
  // (Re-)initialize field instance.
  var stateParams = {
    field: fieldId,
    editor: formatInfo.editor,
    'status': enabled,
    format: fieldInfo.activeFormat,
    resizable: fieldInfo.resizable
  };
  var internalInstance = new WysiwygInternalInstance(stateParams);
  _internalInstances[fieldId] = internalInstance;
  Drupal.wysiwyg.instances[fieldId] = internalInstance.publicInstance;
  // Attach editor, if enabled by default or last state was enabled.
  Drupal.wysiwyg.editor.attach[editor].call(internalInstance, context, stateParams, clonedSettings);
}

/**
 * Detach all editors from a target element.
 *
 * Ensures Drupal's original textfield resize functionality is restored if
 * enabled and the triggering reason is 'unload'.
 *
 * @param context
 *   A DOM element, supplied by Drupal.detachBehaviors().
 * @param fieldId
 *   The id of an element to attach an editor to.
 * @param trigger
 *   A string describing what is causing the editor to be detached.
 *   - 'serialize': The editor normally just syncs its contents to the original
 *     textarea for value serialization before an AJAX request.
 *   - 'unload': The editor is to be removed completely and the original
 *     textarea restored.
 *
 * @see Drupal.detachBehaviors()
 */
Drupal.wysiwygDetach = function (context, fieldId, trigger) {
  var fieldInfo = getFieldInfo(fieldId),
      trigger = trigger || 'unload';
  // Detach from main field.
  detachFromField(fieldId, context, trigger);
  if (trigger == 'unload') {
    // Attach the resize behavior by forcing status to false. Other values are
    // intentionally kept the same to show which editor is normally attached.
    attachToField(fieldId, context, {forceDisabled: true});
    Drupal.wysiwygAttachToggleLink(context, fieldId);
  }
};

/**
 * Helper to detach and clean up after an editor for a single field.
 *
 * Removes the 'instance' object under Drupal.wysiwyg.instances[fieldId].
 *
 * @param mainFieldId
 *  The id of the field's main element, for fetching field info.
 * @param context
 *   A DOM element, supplied by Drupal.detachBehaviors().
 * @param trigger
 *   A string describing what is causing the editor to be detached.
 *   - 'serialize': The editor normally just syncs its contents to the original
 *     textarea for value serialization before an AJAX request.
 *   - 'unload': The editor is to be removed completely and the original
 *     textarea restored.
 *
 * @see Drupal.wysiwygDetach()
 */
function detachFromField(mainFieldId, context, trigger) {
  var fieldInfo = getFieldInfo(mainFieldId);
  // Summaries are not supported in D6.
  var fieldId = mainFieldId;
  var enabled = false;
  var editor = 'none';
  if (_internalInstances[fieldId]) {
    enabled = _internalInstances[fieldId]['status'];
    editor = (enabled ? _internalInstances[fieldId].editor : 'none');
  }
  var stateParams = {
    field: fieldId,
    'status': enabled,
    editor: fieldInfo.editor,
    format: fieldInfo.activeFormat,
    resizable: fieldInfo.resizable
  };
  if (jQuery.isFunction(Drupal.wysiwyg.editor.detach[editor])) {
    Drupal.wysiwyg.editor.detach[editor].call(_internalInstances[fieldId], context, stateParams, trigger);
  }
  if (trigger == 'unload') {
    delete Drupal.wysiwyg.instances[fieldId];
    delete _internalInstances[fieldId];
  }
}

/**
 * Append or update an editor toggle link to a target element.
 *
 * @param context
 *   A DOM element, supplied by Drupal.attachBehaviors().
 * @param fieldId
 *   The id of an element to attach an editor to.
 */
Drupal.wysiwygAttachToggleLink = function(context, fieldId) {
  var fieldInfo = getFieldInfo(fieldId),
      editor = fieldInfo.getFormatInfo().editor;
  if (!fieldInfo.getFormatInfo().toggle) {
    // Otherwise, ensure that toggle link is hidden.
    $('#wysiwyg-toggle-' + fieldId).hide();
    return;
  }
  if (!$('#wysiwyg-toggle-' + fieldId, context).length) {
    var text = document.createTextNode(fieldInfo.enabled ? Drupal.settings.wysiwyg.disable : Drupal.settings.wysiwyg.enable),
      a = document.createElement('a'),
      div = document.createElement('div');
    $(a).attr({ id: 'wysiwyg-toggle-' + fieldId, href: 'javascript:void(0);' }).append(text);
    $(div).addClass('wysiwyg-toggle-wrapper').append(a);
    $('#' + fieldId).after(div);
  }
  $('#wysiwyg-toggle-' + fieldId, context)
    .html(fieldInfo.enabled ? Drupal.settings.wysiwyg.disable : Drupal.settings.wysiwyg.enable).show()
    .unbind('click.wysiwyg')
    .bind('click.wysiwyg', { 'fieldId': fieldId, 'context': context }, Drupal.wysiwyg.toggleWysiwyg);

  // Hide toggle link in case no editor is attached.
  if (editor == 'none') {
    $('#wysiwyg-toggle-' + fieldId).hide();
  }
};

/**
 * Callback for the Enable/Disable rich editor link.
 */
Drupal.wysiwyg.toggleWysiwyg = function (event) {
  var context = event.data.context,
      fieldId = event.data.fieldId,
      fieldInfo = getFieldInfo(fieldId);
  // Toggling the enabled state indirectly toggles use of the 'none' editor.
  if (fieldInfo.enabled) {
    fieldInfo.enabled = false;
    Drupal.wysiwygDetach(context, fieldId, 'unload');
  }
  else {
    fieldInfo.enabled = true;
    Drupal.wysiwygAttach(context, fieldId);
  }
  fieldInfo.formats[fieldInfo.activeFormat].enabled = fieldInfo.enabled;
}


/**
 * Event handler for when the selected format is changed.
 */
function formatChanged(event) {
  // Backported from D7 where a selectbox is used instead of radios.
  var fieldId = _selectToField[this.name.replace(/--\d+$/,'')];
  var context = $(this).parents('form');
  var newFormat = 'format' + $(this).val();
  // Field state is fetched by reference.
  var currentField = getFieldInfo(fieldId);
  // Prevent double-attaching if change event is triggered manually.
  if (newFormat === currentField.activeFormat) {
    return;
  }
  // Save the state of the current format.
  if (currentField.formats[currentField.activeFormat]) {
    currentField.formats[currentField.activeFormat].enabled = currentField.enabled;
  }
  // Switch format/profile.
  currentField.activeFormat = newFormat;
  // Load the state from the new format.
  if (currentField.formats[currentField.activeFormat]) {
    currentField.enabled = currentField.formats[currentField.activeFormat].enabled;
  }
  else {
    currentField.enabled = false;
  }
  // Attaching again will use the changed field state.
  Drupal.wysiwygAttach(context, fieldId);
}

/**
 * Convert JSON type placeholders into the actual types.
 *
 * Recognizes function references (callbacks) and Regular Expressions.
 *
 * To create a callback, pass in an object with the following properties:
 * - 'drupalWysiwygType': Must be set to 'callback'.
 * - 'name': A string with the name of the callback, use
 *   'object.subobject.method' syntax for methods in nested objects.
 * - 'context': An optional string with the name of an object for overriding
 *   'this' inside the function. Use 'object.subobject' syntax for nested
 *   objects. Defaults to the window object.
 *
 * To create a RegExp, pass in an object with the following properties:
 * - 'drupalWysiwygType: Must be set to 'regexp'.
 * - 'regexp': The Regular Expression as a string, without / wrappers.
 * - 'modifiers': An optional string with modifiers to set on the RegExp object.
 *
 * @param json
 *  The json argument with all recognized type placeholders replaced by the real
 *  types.
 *
 * @return The JSON object with placeholder types replaced.
 */
function processObjectTypes(json) {
  var out = null;
  if (typeof json != 'object') {
    return json;
  }
  out = new json.constructor();
  if (json.drupalWysiwygType) {
    switch (json.drupalWysiwygType) {
      case 'callback':
        out = callbackWrapper(json.name, json.context);
        break;
      case 'regexp':
        out = new RegExp(json.regexp, json.modifiers ? json.modifiers : undefined);
        break;
      default:
        out.drupalWysiwygType = json.drupalWysiwygType;
    }
  }
  else {
    for (var i in json) {
      if (json.hasOwnProperty(i) && json[i] && typeof json[i] == 'object') {
        out[i] = processObjectTypes(json[i]);
      }
      else {
        out[i] = json[i];
      }
    }
  }
  return out;
}

/**
 * Convert function names into function references.
 *
 * @param name
 *  The name of a function to use as callback. Use the 'object.subobject.method'
 *  syntax for methods in nested objects.
 * @param context
 *  An optional string with the name of an object for overriding 'this' inside
 *  the function. Use 'object.subobject' syntax for nested objects. Defaults to
 *  the window object.
 *
 * @return
 *  A function which will call the named function or method in the proper
 *  context, passing through arguments and return values.
 */
function callbackWrapper(name, context) {
  var namespaces = name.split('.'), func = namespaces.pop(), obj = window;
  for (var i = 0; obj && i < namespaces.length; i++) {
    obj = obj[namespaces[i]];
  }
  if (!obj) {
    throw "Wysiwyg: Unable to locate callback " + namespaces.join('.') + "." + func + "()";
  }
  if (!context) {
    context = obj;
  }
  else if (typeof context == 'string'){
    namespaces = context.split('.');
    context = window;
    for (i = 0; context && i < namespaces.length; i++) {
      context = context[namespaces[i]];
    }
    if (!context) {
      throw "Wysiwyg: Unable to locate context object " + namespaces.join('.');
    }
  }
  if (typeof obj[func] != 'function') {
    throw "Wysiwyg: " + func + " is not a callback function";
  }
  return function () {
    return obj[func].apply(context, arguments);
  }
}

// Respond to CTools detach behaviors event.
$(document).unbind('CToolsDetachBehaviors.wysiwyg').bind('CToolsDetachBehaviors.wysiwyg', function(event, context) {
  $('.wysiwyg-processed:input', context).each(function () {
    Drupal.wysiwygDetach(context, this.id, 'unload');
    // The 'none' instances are destroyed with the dialog.
    delete Drupal.wysiwyg.instances[this.id];
    delete _internalInstances[this.id];
    var baseFieldId = (this.id.indexOf('--') === -1 ? this.id : this.id.substr(0, this.id.indexOf('--')));
    delete _fieldInfoStorage[baseFieldId];
  }).removeClass('wysiwyg-processed');
});

// A few hacks to handle AHAH, only needed in D6.
if (Drupal.ahah) {
  // The version of jquery.form.js shipped with D6 tries to trigger an event
  // called "form.pre.serialize", which jQuery thinks means a namespaced "form"
  // event so any handlers are never called. This forcibly registers an event
  // with the full name.
  $.event.global['form.pre.serialize'] = true;
  // Editors must be detached before content is replaced.
  // Core re-attaches behaviors on the new content.
  var oldAhahSuccess = Drupal.ahah.prototype.success;
  Drupal.ahah.prototype.success = function (response, status) {
    var context = $(this.wrapper);
    var wysiwygs = context.find('.wysiwyg-processed:input');
    wysiwygs.each(function () {
      Drupal.wysiwygDetach(context, this.id, 'unload');
    });
    wysiwygs.removeClass('wysiwyg-processed');
    oldAhahSuccess.call(this, response, status);
  }
}

// A few hacks to handle sortable tables, only needed in D6.
if (Drupal.tableDrag) {
  // Editors can't handle being moved around without being detached first.
  Drupal.tableDrag.prototype.row.prototype.swap = function (position, row) {
    var context = $(this.group);
    var wysiwygs = context.find('.wysiwyg-processed:input');
    wysiwygs.each(function () {
      Drupal.wysiwygDetach(context, this.id, 'move');
    });
    wysiwygs.removeClass('wysiwyg-processed');
    $(row)[position](this.group);
    Drupal.behaviors.attachWysiwyg(context);
    this.changed = true;
    this.onSwap(row);
  }
}

})(jQuery);
