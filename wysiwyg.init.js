
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
    if (!node || node.nodeType != 1) {return '';}
    var children = node.childNodes;
    var xhtmlContent = '';
    for (var i=0; i< children.length; i++) {
      var child = children[i];
      if (child.nodeType == 3) {
        // Text.
        xhtmlContent += child.nodeValue.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }
      else if (child.nodeType == 8) {
        // Comment.
        xhtmlContent += '<!--' + child.nodeValue + '-->';
      }
      else {
        xhtmlContent += '<' + child.nodeName.toLowerCase();
        var attributes = child.attributes;
        for (var j=0; j < attributes.length; j++) {
          var attribute = attributes[j];
          var attName = attribute.nodeName.toLowerCase();
          var attValue = attribute.nodeValue;
          if (attName == 'style' && child.style.cssText) {
            // Todo: not very nice way to handle styles.
            xhtmlContent += ' style="' + child.style.cssText.toLowerCase() + '"';
          }
          else if (attValue && attName != 'contenteditable') {
            xhtmlContent += ' ' + attName + '="' + attValue + '"';
          }
        }
        var tagName = child.nodeName.toLowerCase();
        var innerContent = _xhtml(child);
        var elemClone = child.cloneNode(true);
        var container = document.createElement('div');
        container.appendChild(elemClone);
        if (!new RegExp('</' + tagName + '>\s*$', 'i').test(container.innerHTML)) {
          xhtmlContent += ' />' + innerContent;
        }
        else {
          xhtmlContent += '>' + innerContent + '</' + tagName + '>';
        }
        delete container;
      }
    }
    return xhtmlContent;
  }

  $.fn.extend({
    xhtml : function (value) {
      return _xhtml(this[0]);
    }
  });
})(jQuery);
