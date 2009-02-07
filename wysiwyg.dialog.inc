<?php
// $Id$

/**
 * @file
 * Wysiwyg dialog page handling functions.
 */

/**
 * Menu callback; Output a wysiwyg plugin dialog page.
 */
function _wysiwyg_dialog($plugin, $instance) {
  $plugins = wysiwyg_get_all_plugins();
  if (!isset($plugins[$plugin])) {
    return drupal_access_denied();
  }
  $callback = $plugin . '_wysiwyg_dialog';
  if (!function_exists($callback)) {
    return drupal_not_found();
  }

  // Suppress admin menu.
  module_invoke('admin_menu', 'suppress');
  // Add editor instance id to Drupal.settings.
  drupal_add_js(array('instance' => $instance), 'setting');

  echo theme('wysiwyg_dialog_page', $callback($instance));
}

/**
 * Template preprocess function for theme_wysiwyg_dialog_page().
 *
 * @see wysiwyg_dialog()
 * @see wysiwyg-dialog-page.tpl.php
 * @see template_preprocess()
 */
function template_preprocess_wysiwyg_dialog_page(&$variables) {
  // Construct page title
  $head_title = array(strip_tags(drupal_get_title()), variable_get('site_name', 'Drupal'));

  $variables['head_title']        = implode(' | ', $head_title);
  $variables['base_path']         = base_path();
  $variables['front_page']        = url();
  // @todo Would a breadcrumb make sense / possible at all?
  // $variables['breadcrumb']        = theme('breadcrumb', drupal_get_breadcrumb());
  $variables['head']              = drupal_get_html_head();
  $variables['help']              = theme('help');
  $variables['language']          = $GLOBALS['language'];
  $variables['language']->dir     = $GLOBALS['language']->direction ? 'rtl' : 'ltr';
  $variables['messages']          = $variables['show_messages'] ? theme('status_messages') : '';
  $variables['site_name']         = (theme_get_setting('toggle_name') ? variable_get('site_name', 'Drupal') : '');
  $variables['css']               = drupal_add_css();
  $variables['styles']            = drupal_get_css();
  $variables['scripts']           = drupal_get_js();
  $variables['tabs']              = theme('menu_local_tasks');
  $variables['title']             = drupal_get_title();
  // Closure should be filled last.
  $variables['closure']           = theme('closure');
}

/**
 * @file
 * Theme template to display a single Wysiwyg (plugin) dialog page.
 *
 * Available variables:
 *
 * Page metadata:
 * - $language: The language the site is being displayed in.
 * - $head_title: A modified version of the page title, for use in the TITLE tag.
 * - $head: Markup for the HEAD section (including meta tags, keyword tags, and
 *   so on).
 * - $styles: Style tags necessary to import all CSS files for the page.
 * - $scripts: Script tags necessary to load the JavaScript files and settings
 *   for the page.
 *
 * Page content (in order of occurrance in the default page.tpl.php):
 * - $breadcrumb: The breadcrumb trail for the current page.
 * - $title: The page title, for use in the actual HTML content.
 * - $help: Dynamic help text, mostly for admin pages.
 * - $messages: HTML for status and error messages. Should be displayed prominently.
 * - $tabs: Tabs linking to any sub-pages beneath the current page (e.g., the view
 *   and edit tabs when displaying a node).
 *
 * - $content: The main content of the current Drupal page.
 *
 * Footer/closing data:
 * - $footer : The footer region.
 * - $closure: Final closing markup from any modules that have altered the page.
 *   This variable should always be output last, after all other dynamic content.
 *
 * @see template_preprocess_wysiwyg_dialog_page()
 */
function theme_wysiwyg_dialog_page() {
  $variables = array();
  template_preprocess_wysiwyg_dialog_page($variables);
  return theme('render_template', drupal_get_path('module', 'wysiwyg') . '/wysiwyg-dialog-page.tpl.php', $variables);
}
