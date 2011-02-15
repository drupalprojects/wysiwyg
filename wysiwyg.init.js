
jQuery.support = jQuery.support || {}; // D6- only.

Drupal.wysiwyg = Drupal.wysiwyg || { 'instances': {} };

Drupal.wysiwyg.editor = Drupal.wysiwyg.editor || { 'init': {}, 'attach': {}, 'detach': {}, 'instance': {} };

Drupal.wysiwyg.plugins = Drupal.wysiwyg.plugins || {};

(function ($) {
  // Determine support for queryCommandEnabled().
  // An exception should be thrown for non-existing commands.
  // Safari and Chrome (WebKit based) return -1 instead.
  try {
    document.queryCommandEnabled('__wysiwygTestCommand');
    $.support.queryCommandEnabled = false;
  }
  catch (error) {
    $.support.queryCommandEnabled = true;
  }

  function _xhtml(node) {
    // (v0.4) Written 2006 by Steve Tucker, http://www.stevetucker.co.uk
    if (!node || typeof node.nodeType == 'undefined') {return '';}
    var xhtmlContent = '', nodeType = node.nodeType;
    if (nodeType == 3) {
      // Text node.
      return node.nodeValue.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    else if (nodeType == 8) {
      // Comment node.
      return '<!--' + node.nodeValue + '-->';
    }
    else if (nodeType == 1) {
      xhtmlContent += '<' + node.nodeName.toLowerCase();
      var attributes = node.attributes;
      for (var j=0; j < attributes.length; j++) {
        var attribute = attributes[j],
          attName = attribute.nodeName.toLowerCase(),
          attValue = attribute.nodeValue;
        if (attName == 'style' && child.style.cssText) {
          // Todo: not very nice way to handle styles.
          xhtmlContent += ' style="' + child.style.cssText.toLowerCase() + '"';
        }
        else if (attValue && attName != 'contenteditable') {
          xhtmlContent += ' ' + attName + '="' + attValue + '"';
        }
      }
      var tagName = child.nodeName.toLowerCase(),
        innerContent = (tagName == 'script' ? child.text  : _xhtml(child)),
        // Clone the node and get its outerHTML to test if it was self-closed.
        elemClone = child.cloneNode(false),
        container = document.createElement('div');
      container.appendChild(elemClone);
      var selfClosed = !new RegExp('</' + tagName + '>\s*$', 'i').test(container.innerHTML);
      delete container;
    }
    else (
      // Unknown node type, possible to serialize?
    }
    var children = node.childNodes;
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      xhtmlContent += _xhtml(child);
    }
    if (nodeType == 1) {
      xhtmlContent += (selfClosed ? ' />' + innerContent : '>' + innerContent + '</' + tagName + '>');
    }
    return xhtmlContent;
  }

  $.fn.extend({
    xhtml : function (value) {
      return _xhtml(this[0]);
    }
  });

  Drupal.wysiwyg.xhtmlToDom = function (content) {
    // Use a pre element to preserve formatting nodes in IE.
    var pre = document.createElement('pre');
    document.body.appendChild(pre);
    // IE 'normalizes' whitespaces when setting .innerHTML.
    if (pre.outerHTML) {
      pre.outerHTML = '<pre id="wysiwyg-pre-element">' + content + '</pre>';
      delete pre;
      pre = document.getElementById('wysiwyg-pre-element');
    }
    else {
      pre.innerHTML = content;
    }
    var dom = document.createDocumentFragment();
    while (pre.firstChild) {
      dom.appendChild(pre.firstChild);
    }
    pre.parentNode.removeChild(pre);
    delete pre;
    return dom;
  }

})(jQuery);
