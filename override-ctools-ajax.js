/**
 * @file
 *
 * Overrides CTools's scripts command to prevent double execution of editor
 * scripts in modern browsers.
 */

(function ($) {
  Drupal.CTools.AJAX.commands.scripts = function(data) {
    // Build a list of scripts already loaded:
    var scripts = {};
    $('script').each(function () {
      var link = Drupal.CTools.AJAX.getPath($(this).attr('src'));
      if (link) {
        Drupal.CTools.AJAX.scripts[link] = $(this).attr('src');
      }
    });

    var html = '';
    var head = document.getElementsByTagName('head')[0];
    for (var i = 0; i < data.argument.length; i++) {
      var link = Drupal.CTools.AJAX.getPath(data.argument[i]);
      if (!Drupal.CTools.AJAX.scripts[link]) {
        Drupal.CTools.AJAX.scripts[link] = link;
        // Use this to actually get the script tag into the dom, which is
        // needed for scripts that self-reference to determine paths.
        var script = document.createElement('script');
        // Changed from text/javascript to prevent double execution.
        script.type = 'text/plain';
        script.src = data.argument[i];
        head.appendChild(script);
        html += '<script type="text/javascript" src="' + data.argument[i] + '"></script>';
      }
    }

    if (html) {
      $('body').append($(html));
    }
  };
})(jQuery);
