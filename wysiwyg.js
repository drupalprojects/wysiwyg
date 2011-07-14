(function($) {

/**
 * Initialize editor libraries.
 *
 * Some editors need to be initialized before the DOM is fully loaded. The
 * init hook gives them a chance to do so.
 */
Drupal.wysiwygInit = function() {
  // This breaks in Konqueror. Prevent it from running.
  if (/KDE/.test(navigator.vendor)) {
    return;
  }

  jQuery.each(Drupal.wysiwyg.editor.init, function(editor) {
    // Clone, so original settings are not overwritten.
    this(jQuery.extend(true, {}, Drupal.settings.wysiwyg.configs[editor]));
  });
};

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
Drupal.behaviors.attachWysiwyg = {
  attach: function(context, settings) {
    // This breaks in Konqueror. Prevent it from running.
    if (/KDE/.test(navigator.vendor)) {
      return;
    }

    $('.wysiwyg', context).once('wysiwyg', function() {
      if (!this.id || typeof Drupal.settings.wysiwyg.triggers[this.id] === 'undefined') {
        return;
      }
      var $this = $(this);
      var params = Drupal.settings.wysiwyg.triggers[this.id];
      for (var format in params) {
        params[format].format = format;
        params[format].trigger = this.id;
        params[format].field = params.field;
      }
      var format = 'format' + this.value;
      // Directly attach this editor, if the input format is enabled or there is
      // only one input format at all.
      if ($this.is(':input')) {
        Drupal.wysiwygAttach(context, params[format]);
      }
      // Attach onChange handlers to input format selector elements.
      if ($this.is('select')) {
        $this.change(function() {
          // If not disabled, detach the current and attach a new editor.
          Drupal.wysiwygDetach(context, params[format]);
          format = 'format' + this.value;
          Drupal.wysiwygAttach(context, params[format]);
        });
      }
      // Detach any editor when the containing form is submitted.
      $('#' + params.field).parents('form').submit(function (event) {
        // Do not detach if the event was cancelled.
        if (event.isDefaultPrevented()) {
          return;
        }
        Drupal.wysiwygDetach(context, params[format]);
      });
    });
  }
};

/**
 * Attach an editor to a target element.
 *
 * This tests whether the passed in editor implements the attach hook and
 * invokes it if available. Editor profile settings are cloned first, so they
 * cannot be overridden. After attaching the editor, the toggle link is shown
 * again, except in case we are attaching no editor.
 *
 * @param context
 *   A DOM element, supplied by Drupal.attachBehaviors().
 * @param params
 *   An object containing input format parameters.
 */
Drupal.wysiwygAttach = function(context, params) {
  if (typeof Drupal.wysiwyg.editor.attach[params.editor] == 'function') {
    // (Re-)initialize field instance.
    Drupal.wysiwyg.instances[params.field] = {};
    // Provide all input format parameters to editor instance.
    jQuery.extend(Drupal.wysiwyg.instances[params.field], params);
    // Provide editor callbacks for plugins, if available.
    if (typeof Drupal.wysiwyg.editor.instance[params.editor] == 'object') {
      jQuery.extend(Drupal.wysiwyg.instances[params.field], Drupal.wysiwyg.editor.instance[params.editor]);
    }
    // Store this field id, so (external) plugins can use it.
    // @todo Wrong point in time. Probably can only supported by editors which
    //   support an onFocus() or similar event.
    Drupal.wysiwyg.activeId = params.field;
    // Attach or update toggle link, if enabled.
    if (params.toggle) {
      Drupal.wysiwygAttachToggleLink(context, params);
    }
    // Otherwise, ensure that toggle link is hidden.
    else {
      $('#wysiwyg-toggle-' + params.field).hide();
    }
    // Attach editor, if enabled by default or last state was enabled.
    if (params.status) {
      Drupal.wysiwyg.editor.attach[params.editor](context, params, (Drupal.settings.wysiwyg.configs[params.editor] ? jQuery.extend(true, {}, Drupal.settings.wysiwyg.configs[params.editor][params.format]) : {}));
    }
    // Otherwise, attach default behaviors.
    else {
      Drupal.wysiwyg.editor.attach.none(context, params);
      Drupal.wysiwyg.instances[params.field].editor = 'none';
    }
  }
};

/**
 * Detach all editors from a target element.
 *
 * @param context
 *   A DOM element, supplied by Drupal.attachBehaviors().
 * @param params
 *   An object containing input format parameters.
 */
Drupal.wysiwygDetach = function(context, params) {
  var editor = Drupal.wysiwyg.instances[params.field].editor;
  if (jQuery.isFunction(Drupal.wysiwyg.editor.detach[editor])) {
    Drupal.wysiwyg.editor.detach[editor](context, params);
  }
};

/**
 * Append or update an editor toggle link to a target element.
 *
 * @param context
 *   A DOM element, supplied by Drupal.attachBehaviors().
 * @param params
 *   An object containing input format parameters.
 */
Drupal.wysiwygAttachToggleLink = function(context, params) {
  if (!$('#wysiwyg-toggle-' + params.field).length) {
    var text = document.createTextNode(params.status ? Drupal.settings.wysiwyg.disable : Drupal.settings.wysiwyg.enable);
    var a = document.createElement('a');
    $(a).attr({ id: 'wysiwyg-toggle-' + params.field, href: 'javascript:void(0);' }).append(text);
    var div = document.createElement('div');
    $(div).addClass('wysiwyg-toggle-wrapper').append(a);
    $('#' + params.field).after(div);
  }
  $('#wysiwyg-toggle-' + params.field)
    .html(params.status ? Drupal.settings.wysiwyg.disable : Drupal.settings.wysiwyg.enable).show()
    .unbind('click.wysiwyg', Drupal.wysiwyg.toggleWysiwyg)
    .bind('click.wysiwyg', { params: params, context: context }, Drupal.wysiwyg.toggleWysiwyg);

  // Hide toggle link in case no editor is attached.
  if (params.editor == 'none') {
    $('#wysiwyg-toggle-' + params.field).hide();
  }
};

/**
 * Callback for the Enable/Disable rich editor link.
 */
Drupal.wysiwyg.toggleWysiwyg = function (event) {
  var context = event.data.context;
  var params = event.data.params;
  if (params.status) {
    // Detach current editor.
    params.status = false;
    Drupal.wysiwygDetach(context, params);
    // After disabling the editor, re-attach default behaviors.
    // @todo We HAVE TO invoke Drupal.wysiwygAttach() here.
    Drupal.wysiwyg.editor.attach.none(context, params);
    Drupal.wysiwyg.instances[params.field] = Drupal.wysiwyg.editor.instance.none;
    Drupal.wysiwyg.instances[params.field].editor = 'none';
    $(this).html(Drupal.settings.wysiwyg.enable).blur();
  }
  else {
    // Before enabling the editor, detach default behaviors.
    Drupal.wysiwyg.editor.detach.none(context, params);
    // Attach new editor using parameters of the currently selected input format.
    params = Drupal.settings.wysiwyg.triggers[params.trigger]['format' + $('#' + params.trigger).val()];
    params.status = true;
    Drupal.wysiwygAttach(context, params);
    $(this).html(Drupal.settings.wysiwyg.disable).blur();
  }
}

/**
 * Parse the CSS classes of an input format DOM element into parameters.
 *
 * Syntax for CSS classes is "wysiwyg-name-value".
 *
 * @param element
 *   An input format DOM element containing CSS classes to parse.
 * @param params
 *   (optional) An object containing input format parameters to update.
 */
Drupal.wysiwyg.getParams = function(element, params) {
  var classes = element.className.split(' ');
  var params = params || {};
  for (var i = 0; i < classes.length; i++) {
    if (classes[i].substr(0, 8) == 'wysiwyg-') {
      var parts = classes[i].split('-');
      var value = parts.slice(2).join('-');
      params[parts[1]] = value;
    }
  }
  // Convert format id into string.
  params.format = 'format' + params.format;
  // Convert numeric values.
  params.status = parseInt(params.status, 10);
  params.toggle = parseInt(params.toggle, 10);
  params.resizable = parseInt(params.resizable, 10);
  return params;
};

/**
 * Serialize a DOM node and its children to an XHTML string.
 *
 * Makes sure source formatting is preserved across all major browsers.
 *
 * @param node
 *   A DOM node, will not be modified.
 *
 * @returns
 *   A string containing the XHTML representation of the node, empty
 *   if the node could not be serialized.
 */
function serialize(node) {
  // Inspired by Steve Tucker's innerXHTML, http://www.stevetucker.co.uk.
  if (!node || (typeof node.nodeType == 'undefined' && typeof node.length == 'undefined' )) {
    return '';
  }
  var xhtmlContent = '', nodeType = node.nodeType, nodeName = (node.nodeName ? node.nodeName.toLowerCase() : '');
  if (typeof nodeType == 'undefined') {
    for (var i = 0; i < node.length; i++) {
      xhtmlContent += serialize(node[i]);
    }
    return xhtmlContent;
  }
  else if (nodeType == 3) {
    // Text node.
    return node.nodeValue.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  else if (nodeType == 8) {
    // Comment node.
    return '<!--' + node.nodeValue + '-->';
  }
  else if (nodeType == 1) {
    // Element node.
    xhtmlContent += '<' + nodeName;
    var attributes = node.attributes;
    for (var j=0; j < attributes.length; j++) {
      var attrib = attributes[j], attName = attrib.nodeName.toLowerCase(), attValue = attrib.nodeValue;
      if ((attValue == 1 && (attName == 'colspan' || attName == 'rowspan' || attName == 'start' || attName == 'loop'))
       || (attName == 'start' && attValue == 'fileopen') ) {
        // IE compatibility mode always sets these, despite being defaults.
        continue;
      }
      if (/^data-wysiwyg-protected-/.test(attName)) {
        // Ignore these temporary attributes, see below.
        continue;
      }
      if ((attName == 'name' || attName == 'src' || attName == 'href') && attributes['data-wysiwyg-protected-' + attName]) {
        // Browsers often turn relative URLs into absolute in these attributes.
        attValue = attributes['data-wysiwyg-protected-' + attName].nodeValue || attValue;
      }
      if (attName == 'style' && node.style.cssText) {
        // IE uppercases style attributes, values must be kept intact.
        var styles = node.style.cssText.replace(/(^|;)([^\:]+)/g, function (match) {
          return match.toLowerCase();
        });
        xhtmlContent += ' style="' + styles + '"';
      }
      else if (attValue && attName != 'contenteditable') {
        xhtmlContent += ' ' + attName + '="' + attValue + '"';
      }
    }
    // Clone the node and get its outerHTML to test if it was self-closed.
    var elemClone = node.cloneNode(false), container = document.createElement('div');
    container.appendChild(elemClone);
    var selfClosed = !new RegExp('</' + nodeName + '>\s*$', 'i').test(container.innerHTML);
    delete container;
  }
  // IE doesn't set nodeValue for script tags.

  if (nodeName == 'script' && node.nodeValue == '') {
    xhtmlContent += node.text;
  }
  else {
    // Process children for types that can have them.
    var children = node.childNodes;
    var innerContent = '';
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      innerContent += serialize(child);
    }
    if (nodeType == 1) {
      if (selfClosed) {
        xhtmlContent += ' />' + innerContent;
      }
      else {
        xhtmlContent += '>' + innerContent + '</' + nodeName + '>';
      }
    }
    else {
      xhtmlContent += innerContent;
    }
  }
  return xhtmlContent;
}

/**
 * Unserialize an XHTML string to one or more DOM nodes.
 *
 * @param content
 *   A valid XHTML string.
 *
 * @returns
 *   One or more DOM nodes wrapped by a DocumentFragment node.
 */
function unserialize(content) {
  // Use a pre element to preserve formatting (#text) nodes in IE.
  var $pre = $('<pre>' + content + '</pre>');
  var pre = $pre[0];
  return pre.childNodes;
  var dom = document.createDocumentFragment();
  while (pre.firstChild) {
    dom.appendChild(pre.firstChild);
  }
  pre.parentNode.removeChild(pre);
  delete pre;
  return dom;
}

/**
 * Masks tags in a markup string as divs.
 *
 * All ocurrances of tags are changed to divs and given an extra
 * "data-masked" attribute to identify the old tag name.
 *
 * @see unmaskTags().
 *
 * @param content
 *   A valid XHTML markup string.
 *
 * @param tags
 *   An array of tag names to be replaced by divs.
 *
 * @returns
 *   An XHTML markup string with all instances of tags replaced by divs.
 */
function maskTags(content, tags) {
  var replaced = content.replace(new RegExp('<(' + tags.join('|') + ')', 'gi'), '<div data-masked="$1" ');
  replaced = replaced.replace(new RegExp('<\/(?:' + tags.join('|') + ')>', 'gi'), '</div>');
  // Borrowed from CKEditor to prevent relative URLs from becoming absolute.
  var protectAttributeRegex = /<((?:a|area|img|input)\b[\s\S]*?\s)((href|src|name)\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|(?:[^ "'>]+)))([^>]*)>/gi;
  replaced = replaced.replace(protectAttributeRegex, function(tag, beginning, fullAttr, attrName, end) {
    return '<' + beginning + fullAttr + ' data-wysiwyg-protected-' + fullAttr + end + '>';
  });
  // Escape entities since the innerHTML operation in unserialize mangles them.
  replaced = replaced.replace(/\&(\w+|#\d+);/g, "<span data-wysiwyg-protected-entity='1'>$1</span>");
  return replaced;
}

/**
 * Unmasks tags previously masked as divs.
 *
 * Recursively looks for nodes having a "data-masked" attribute and creates
 * new element nodes of the corresponding type. Other nodes are just cloned.
 *
 * @see maskTags().
 *
 * @param node
 *   A DOM node to create a unmasked clone of.
 *
 * @returns
 *   A clone of the given DOM tree, after unmasking placeholders.
 */
function unmaskTags(node) {
  var unmaskedTag = null;
  if (node && typeof node.nodeType == 'undefined' && typeof node.length != 'undefined') {
    var list = [];
    for (var i = 0; i < node.length; i++) {
      list[i] = unmaskTags(node[i]);
    }
    return list;
  }
  else if (node.getAttribute) {
    if (node.getAttribute('data-masked')) {
      // Create the new element and transfer attributes from the placeholder.
      unmaskedTag = node.ownerDocument.createElement(node.getAttribute('data-masked'));
      for (var i = 0; i < node.attributes.length; i++) {
        var attribute = node.attributes[i];
        if (attribute.specified && attribute.name.toLowerCase() != 'data-masked') {
          unmaskedTag.setAttribute(attribute.name, attribute.value);
        }
      }
    }
    else if (node.getAttribute('data-wysiwyg-protected-entity')) {
      // Recreate the entity as a text node, will be merged with siblings later.
      // Text nodes can't have children so return right away.
      return document.createTextNode('&' + node.innerText + ';');
    }
    else {
      // The node was not masked, just clone it.
      unmaskedTag = node.cloneNode(false);
    }
  }
  else if (node.nodeType == 3 && node.nodeValue == '') {
    // Skip empty text nodes.
    return null;
  }
  else {
    // The node doesn't support attributes, just clone it.
    unmaskedTag = node.cloneNode(false);
  }
  for (var i = 0; i < node.childNodes.length; i++) {
    var clonedChild = unmaskTags(node.childNodes[i]);
    if (clonedChild) {
      unmaskedTag.appendChild(clonedChild);
    }
  }
  if (unmaskedTag.normalize) {
    // Merge text nodes.
    unmaskedTag.normalize();
  }
  return unmaskedTag;
}

/**
 *  Utility functions provided by Wysiwyg.
 */
Drupal.wysiwyg.utilities = {

  /**
   * Temporarily convert XHTML to a DOM and back again via a callback.
   *
   * Provides a convenient way to modify a valid XHTML string as DOM nodes.
   * Preserves source indentation and whitespaces as #text nodes in all major
   * browsers, otherwise not possible using .innerHTML in IE.
   *
   * @param content
   *   A valid XHTML string.
   *
   * @param callback
   *   A callback function to be called when DOM nodes have been generated.
   *   The callback may modify the DOM nodes in any way needed. If assigning an
   *   element's src or href attribute and it's important for URIs to be
   *   relative, also assign the same value to the corresponding
   *   data-wysiwyg-protected-[attribute name] attribute. It keeps the browser from
   *   making the URI absolute. The same rule applies when reading these
   *   attributes. Instead of element.getAttribute('src'), do
   *   element.getAttribute('data-wysiwyg-protected-src') etc.
   *
   *   The callback's return value is ignored.
   *
   * @returns
   *   An XHTML string representing the DOM nodes as left by the callback.
   */
  modifyAsDom : function (content, callback) {
    var tags = ['table', 'caption', 'colgroup', 'col', 'thead', 'tbody', 'tr', 'th', 'td', 'tfoot'];
    var dom = unmaskTags(unserialize(maskTags(content, tags)));
    callback(dom);
    var clone = serialize(dom);
    return clone;
  }
}

/**
 * Allow certain editor libraries to initialize before the DOM is loaded.
 */
Drupal.wysiwygInit();

})(jQuery);
