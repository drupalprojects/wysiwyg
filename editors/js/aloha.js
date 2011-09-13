(function($) {

/**
 * Attach this editor to a target element.
 */
Drupal.wysiwyg.editor.attach.aloha = function(context, params, settings) {
  // Setup configuration.
  GENTICS.Aloha.settings = settings;

  // @todo Convert textarea into DIV.

  // Attach editor.
  $('#' + params.field).aloha();
};

/**
 * Detach a single or all editors.
 *
 * See Drupal.wysiwyg.editor.detach.none() for a full desciption of this hook.
 */
Drupal.wysiwyg.editor.detach.aloha = function(context, params) {
  if (typeof params != 'undefined') {
    $('#' + params.field).mahalo();
  }
  else {
    for (var e in GENTICS.Aloha.editables) {
      GENTICS.Aloha.editables[e].destroy();
    }
  }
};

})(jQuery);
