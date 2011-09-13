<?php

/**
 * @file
 * Editor integration functions for Aloha editor.
 */

/**
 * Plugin implementation of hook_editor().
 */
function wysiwyg_aloha_editor() {
  $editor['aloha'] = array(
    'title' => 'Aloha editor',
    'vendor url' => 'http://www.aloha-editor.org/',
    'download url' => 'http://www.aloha-editor.org/',
    'library path' => wysiwyg_get_path('aloha') . '/aloha',
    'libraries' => array(
      // @todo jQuery version conflict.
      'min-bundled' => array(
        'title' => 'Minified (bundled with jQuery + ExtJS)',
        'files' => array(
          // @todo Bundled jQuery (1.4.2) and Drupal's (1.4.4) are incompatible.
          //   Even hacking a var jQuery=jQuery||function... into aloha.js leads
          //   to JS errors. However, other dependencies (e.g., ExtJS) are not
          //   included otherwise. No idea how aloha.module is able to work...
          // Loads directly after jquery.js of core. No error on load, but
          // "handler undefined" error on attach. 13/09/2011 sun
          'aloha.js' => array('group' => JS_LIBRARY, 'weight' => -20, 'every_page' => TRUE),
          // Loads before core. jquery.fn.aloha() undefined. 13/09/2011 sun
          #'aloha.js' => array('group' => JS_LIBRARY - 1),
          // @todo These are actually optional plugins.
          'plugins/com.gentics.aloha.plugins.Format/plugin.js',
          'plugins/com.gentics.aloha.plugins.Table/plugin.js',
          'plugins/com.gentics.aloha.plugins.List/plugin.js',
          'plugins/com.gentics.aloha.plugins.Link/plugin.js',
        ),
      ),
      'min' => array(
        'title' => 'Minified',
        'files' => array(
          'aloha-nodeps.js',
          // @todo These are actually optional plugins.
          'plugins/com.gentics.aloha.plugins.Format/plugin.js',
          'plugins/com.gentics.aloha.plugins.Table/plugin.js',
          'plugins/com.gentics.aloha.plugins.List/plugin.js',
          'plugins/com.gentics.aloha.plugins.Link/plugin.js',
        ),
      ),
    ),
    'version callback' => 'wysiwyg_aloha_version',
    'load callback' => 'wysiwyg_aloha_load',
    'settings callback' => 'wysiwyg_aloha_settings',
    'plugin callback' => 'wysiwyg_aloha_plugins',
    'versions' => array(
      '0.9.3' => array(
        'js files' => array('aloha.js'),
      ),
    ),
  );
  return $editor;
}

/**
 * Detect editor version.
 *
 * @param $editor
 *   An array containing editor properties as returned from hook_editor().
 *
 * @return
 *   The installed editor version.
 */
function wysiwyg_aloha_version($editor) {
  $library = $editor['library path'] . '/VERSION.txt';
  if (!file_exists($library)) {
    return;
  }
  $library = fopen($library, 'r');
  $max_lines = 1;
  while ($max_lines && $line = fgets($library, 60)) {
    if (preg_match('@^([0-9\._-]+)@', $line, $version)) {
      fclose($library);
      return $version[1];
    }
    $max_lines--;
  }
  fclose($library);
}

/**
 * Perform additional actions upon loading this editor.
 *
 * @param $editor
 *   A processed hook_editor() array of editor properties.
 * @param $library
 *   The internal library name (array key) to use.
 */
function wysiwyg_aloha_load($editor, $library) {
  drupal_add_css($editor['library path'] . '/css/aloha.css');
}

/**
 * Return runtime editor settings for a given wysiwyg profile.
 *
 * @param $editor
 *   A processed hook_editor() array of editor properties.
 * @param $config
 *   An array containing wysiwyg editor profile settings.
 * @param $theme
 *   The name of a theme/GUI/skin to use.
 *
 * @return
 *   A settings array to be populated in
 *   Drupal.settings.wysiwyg.configs.{editor}
 */
function wysiwyg_aloha_settings($editor, $config, $theme) {
  $settings = array(
    'base' => $editor['library path'] . '/',
    'ribbon' => FALSE,
    /*
    'logLevels' => array(
      'error' => TRUE,
      'warn' => TRUE,
      'info' => FALSE,
      'debug' => FALSE,
    ),
    'errorhandling' => FALSE,
    'i18n' => array(
      'acceptLanguage' => $_SERVER['HTTP_ACCEPT_LANGUAGE']
    ),
    */
    'plugins' => array(
    // @todo Doesn't belong here.
      'com.gentics.aloha.plugins.Link' => array(
        'targetregex' => "^(?!.*" . $GLOBALS['base_url'] . ").*",
        'target' => '_blank',
        'cssclassregex' => "^(?!.*" . $GLOBALS['base_url'] . ").*",
        'cssclass' => 'external',
      ),
      'com.gentics.aloha.plugins.Table' => array(
        'config' => array('table'),
      ),
    ),
  );

  return $settings;
}

/**
 * Return internal plugins for this editor; semi-implementation of hook_wysiwyg_plugin().
 */
function wysiwyg_aloha_plugins($editor) {
  return array(
    'default' => array(
      'buttons' => array(
        'Format' => t('HTML block format'),
        'List' => t('List'),
        'Link' => t('Link'),
        'LinkChecker' => t('LinkChecker'),
        'HighlightEditables' => t('Highlight Editables'),
        'Table' => t('Table'),
        'Abbr' => t('Abbreviation'),
        'Paste' => t('Paste'),
        'TOC' => t('TOC'),
      ),
      'internal' => TRUE,
    ),
  );
}

