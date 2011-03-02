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

Drupal.wysiwyg.utilities = {

  /**
   * Serialize a DOM node and its children to an XHTML string.
   *
   * Makes sure element and attribute names are lowercased and source formatting
   * preserved by Drupal.wysiwyg.utilities.xhtmlToDom() stays intact.
   *
   * @param node
   *  A DOM node.
   *
   * @returns
   *  A string containing the XHTML representation of the node, empty
   *  if the node could not be serialized.
   */
  domToXhtml : function (node) {
    // Inspired by Steve Tucker's innerXHTML, http://www.stevetucker.co.uk.
    if (!node || typeof node.nodeType == 'undefined') {
      return '';
    }
    var nodeName = node.nodeName.toLowerCase(), xhtmlContent = '', nodeType = node.nodeType;
    if (nodeType == 3) {
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
        if ((attName == 'colspan' || attName == 'rowspan') && attValue == 1) {
          // IE always sets colSpan and rowSpan even if they == 1.
          continue;
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
        innerContent += Drupal.wysiwyg.utilities.domToXhtml(child);
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
  },

  /**
   * Deserialize an XHTML string to a DOM node hierarchy.
   *
   * Makes sure white-space #text nodes between element nodes are not collapsed
   * in IE to keep source formatting when re-serialized using
   * Drupal.wysiwyg.utils.domToXHTML().
   *
   * @param content
   *  A markup string to be deserialized. Must be valid XHTML.
   *
   * @param context
   *  A node or document to set as the owning document for the new DOM nodes.
   *  The passed in object is not directly modified. Defaults to the current
   *  document.
   *
   * @returns
   *  A DocumentFragment containing the deserialized DOM nodes, empty if no
   *  nodes could be created.
   */
  xhtmlToDom : function (content, context) {
    context = (context && context.nodeType == 9 ? context : document)
    var tags = ['table', 'caption', 'colgroup', 'col', 'thead', 'tbody', 'tr', 'th', 'td', 'tfoot'];
    content = Drupal.wysiwyg.utilities.replaceTags(content, tags);
    // Use a pre element to preserve formatting (#text) nodes in IE.
    var $pre = $('<pre>' + content + '</pre>');
    var pre = $pre[0];
    var dom = context.createDocumentFragment();
    while (pre.firstChild) {
      dom.appendChild(pre.firstChild);
    }
    pre.parentNode.removeChild(pre);
    delete pre;
    return Drupal.wysiwyg.utilities.restoreTags(dom);
  },

  /**
   * Replace tags with div placeholders in a markup string.
   *
   * IE does not preserve whitespaces (#text nodes) around table-related
   * tags even when inserted in a pre tag. Instead, use a div with a
   * 'wasothertag' attribute holding the original tag name.
   *
   * @see Drupal.wysiwyg.utilities.restoreTags().
   *
   * @param content
   *  A valid XHTML markup string.
   *
   * @param tags
   *  An array of tag names to be replaced by divs.
   *
   * @returns
   *  An XHTML markup string with all instances of tags replaced by divs.
   */
  replaceTags : function (content, tags) {
    var replaced = content.replace(new RegExp('<(' + tags.join('|') + ')', 'gi'), '<div wasothertag="$1" ');
    replaced = replaced.replace(new RegExp('<\/(?:' + tags.join('|') + ')>', 'gi'), '</div>');
    return replaced;
  },

  /**
   * Restores tags previously replaced with div placeholders.
   *
   * This function walks the DOM tree and recreates the original nodes.
   *
   * @see Drupal.wysiwyg.utilities.replaceTags().
   *
   * @param node
   *  A DOM node to check for div placeholders, including its children.
   *  This node is not modified.
   *
   * @returns
   *  A clone of the node passed in, after restoring placeholders.
   */
  restoreTags : function (node) {
    var restoredTag = null;
    if (node.getAttribute && node.getAttribute('wasothertag')) {
      // Create the new element and transfer attributes from the placeholder.
      restoredTag = node.ownerDocument.createElement(node.getAttribute('wasothertag'));
      for (var i = 0; i < node.attributes.length; i++) {
        var attribute = node.attributes[i];
        if (attribute.specified && attribute.name.toLowerCase() != 'wasothertag') {
          restoredTag.setAttribute(attribute.name, attribute.value);
        }
      }
    }
    else {
      // The node doesn't support attributes or was not a placeholder.
      // The node is cloned rather than moved so children are kept in place.
      restoredTag = node.cloneNode(false);
    }
    for (var i = 0; i < node.childNodes.length; i++) {
      restoredTag.appendChild(Drupal.wysiwyg.utilities.restoreTags(node.childNodes[i]));
    }
    return restoredTag;
  }
}

$.fn.extend({
  wysiwygXhtml : function () {
    return (this.length > 0 ? Drupal.wysiwyg.utilities.domToXhtml(this[0]) : '');
  }
});

/**
 * Allow certain editor libraries to initialize before the DOM is loaded.
 */
Drupal.wysiwygInit();

})(jQuery);
