<?php

/**
 * @file
 * Integrate Wysiwyg editors into Drupal.
 */

/**
 * Form builder for Wysiwyg profile form.
 */
function wysiwyg_profile_form($form_state, $profile) {
  // Merge in defaults.
  $profile = (array) $profile;
  $profile += array(
    'format' => 0,
    'editor' => '',
  );
  $profile = (object) $profile;
  if (!$profile->settings) {
    $profile->settings = array();
  }
  $editor = wysiwyg_get_editor($profile->editor);
  if (!$editor) {
    // A missing library or unrecognized version, no edit link is shown so users
    // should not get here.
    drupal_goto('admin/settings/wysiwyg');
  }
  // Editor settings.
  $settings = &$profile->settings;
  $settings += array(
    'theme' => '',
    'language' => 'en',
    'buttons' => array(),
    'css_setting' => 'theme',
    'css_path' => NULL,
  );

  if (!isset($profile->preferences)) {
    $profile->preferences = array();
  }

  // Wysiwyg profile preferences, not used directly by the editor.
  $preferences = &$profile->preferences;
  $preferences += array(
    'default' => TRUE,
    'show_toggle' => TRUE,
    'user_choose' => FALSE,
    'version' => NULL,
  );
  $installed_version = $editor['installed version'];
  $profile_version = $preferences['version'];
  $formats = filter_formats();
  drupal_set_title(t('%editor profile for %format', array('%editor' => $editor['title'], '%format' => $formats[$profile->format]->name)));

  $form['format'] = array('#type' => 'value', '#value' => $profile->format);
  $form['input_format'] = array('#type' => 'value', '#value' => $formats[$profile->format]->name);
  $form['editor'] = array('#type' => 'value', '#value' => $profile->editor);

  $form['basic'] = array(
    '#type' => 'fieldset',
    '#title' => t('Basic setup'),
    '#collapsible' => TRUE,
    '#collapsed' => TRUE,
    '#group' => 'advanced',
  );

  $form['basic']['info'] = array(
    'editor_version' => array(
      '#prefix' => '<p>',
      '#value' => t('Installed editor library version: @installed_version', array('@installed_version' => (!empty($installed_version) ? $installed_version : t('Unknown')))),
    ),
    'profile_version' => array(
      '#prefix' => '<br />',
      '#value' => t('Version expected by profile: @profile_version', array('@profile_version' => (!empty($profile_version) ? $profile_version : t('Unknown')))),
      '#suffix' => '</p>',
    ),
  );

  $version_verified = $editor['installed version verified'];
  $migrate_message = '';
  $migrate_status = 'status';
  if (!empty($editor['verified version range'])) {
    $verified_range = $editor['verified version range'];
    $form['basic']['info']['verified_range'] = array(
      '#prefix' => '<p>',
      '#value' => t('<a href="!url" target="_blank" title="Supported editor versions">Verified version range: @min_version to @max_version</a>', array(
        '@min_version' => $verified_range[0],
        '@max_version' => $verified_range[1],
        '!url' => url('https://www.drupal.org/node/596966'),
      )),
      '#suffix' => '</p>',
    );
    if (!$version_verified) {
      $migrate_status = 'warning';
      $form['basic']['info']['editor_version']['#value'] .= ' <span class="warning">' . t('Untested!') . '</span>';
    }
    $version_diff = version_compare((empty($profile_version) ? $installed_version : $profile_version), $installed_version);
    if ($version_diff !== 0) {
      $migrate_message = t('The installed editor library version was changed from @profile_version to @installed_version since this profile was last saved.', array('@profile_version' => $profile_version, '@installed_version' => $installed_version));
      // If the editor integration supports migration between versions, attempt
      // it before widgets for settings are rendered.
      if (isset($editor['migrate settings callback']) && function_exists($editor['migrate settings callback'])) {
        // Get the version migrated to. MUST be in the verified version range,
        // FALSE if no migration was possible, or TRUE if no change needed.
        $migrated_version = $editor['migrate settings callback']($settings, $editor, $profile_version, $installed_version);
        $profile->changed = ($migrated_version !== TRUE && $migrated_version != $profile_version);
        if ($migrated_version === FALSE) {
          $migrate_message .= ' ' . t('Wysiwyg is not able to automatically adapt the profile to the installed editor version. It is recommended to start over with a new profile.');
          $migrate_status = 'error';
        }
        // Migrations are likely not needed for every library update, as long
        // as the installed version is within the verified range, we're good.
        elseif ($version_verified) {
          $migrate_message .= ' ' . ($profile->changed ? t('The profile was automatically adapted to better match the installed editor version, but please check all settings before proceeding.') : t('No known changes to the profile were needed, but please check all settings before proceeding'));
        }
        else {
          $closest_version = ($version_diff === 1 ? $verified_range[0] : $verified_range[1]);
          $migrate_message .= ' ' . t('Wysiwyg was only able to adapt the profile to editor version %version, any additional differences to the installed version will not be accounted for and the editor may not work as expected.', array('%version' => $closest_version));
          $migrate_status = 'warning';
        }
      }
    }
  }
  if (!$version_verified) {
    $migrate_message .= (empty($migrate_message) ? '' : ' ') . t('The installed version has not been tested, the editor may not work as expected.');
    $migrate_status = 'warning';
  }
  if (!empty($migrate_message)) {
    $form['basic']['info'][''] = array(
      '#prefix' => '<div class="messages ' . $migrate_status . '">',
      '#value' => $migrate_message . ' ' . t('This message is shown until the profile is saved while a verified version is installed.'),
      '#suffix' => '</div>',
    );
  }
  if (empty($profile->new) && !empty($profile->changed)) {
    drupal_set_message(t('All changes are stored temporarily. Click Save to make your changes permanent. Click Cancel to discard any changes.'), 'warning');
  }

  if (isset($profile->locked) && is_object($profile->locked)) {
    $form['locked'] = array(
      '#prefix' => '<div class="profile-locked messages warning">',
      '#value' => t('This profile is being edited by user !user, and is therefore locked from editing by others. This lock is !age old. Click here to <a href="!break">break this lock</a>.', array('!user' => theme('username', user_load($profile->locked->uid)), '!age' => format_interval(time() - $profile->locked->updated), '!break' => url('admin/settings/wysiwyg/profile/' . $profile->format. '/break-lock'))),
      '#suffix' => '</div>',
    );
  }

  $form['basic']['default'] = array(
    '#type' => 'checkbox',
    '#title' => t('Enabled by default'),
    '#default_value' => $preferences['default'],
    '#return_value' => 1,
    '#description' => t('The default editor state for users having access to this profile. Users are able to override this state if the next option is enabled.'),
    '#parents' => array('preferences', 'default'),
  );

  $form['basic']['user_choose'] = array(
    '#type' => 'checkbox',
    '#title' => t('Allow users to choose default'),
    '#default_value' => $preferences['user_choose'],
    '#return_value' => 1,
    '#description' => t('If allowed, users will be able to choose their own editor default state in their user account settings.'),
    '#parents' => array('preferences', 'user_choose'),
  );

  $form['basic']['show_toggle'] = array(
    '#type' => 'checkbox',
    '#title' => t('Show <em>enable/disable rich text</em> toggle link'),
    '#default_value' => $preferences['show_toggle'],
    '#return_value' => 1,
    '#description' => t('Whether or not to show the <em>enable/disable rich text</em> toggle link below a textarea. If disabled, the user setting or global default is used (see above).'),
    '#parents' => array('preferences', 'show_toggle'),
  );

  $form['basic']['theme'] = array(
    '#type' => 'hidden',
    '#value' => $settings['theme'],
  );

  $form['basic']['language'] = array(
    '#type' => 'select',
    '#title' => t('Interface language'),
    '#default_value' => $settings['language'],
  );
  // @see _locale_prepare_predefined_list()
  require_once './includes/locale.inc';
  $predefined = _locale_get_predefined_list();
  foreach ($predefined as $key => $value) {
    // Include native name in output, if possible.
    if (count($value) > 1) {
      $tname = t($value[0]);
      $predefined[$key] = ($tname == $value[1]) ? $tname : "$tname ($value[1])";
    }
    else {
      $predefined[$key] = t($value[0]);
    }
  }
  asort($predefined);
  $form['basic']['language']['#options'] = $predefined;

  $form['buttons'] = array(
    '#type' => 'fieldset',
    '#title' => t('Buttons and plugins'),
    '#collapsible' => FALSE,
    '#tree' => TRUE,
    '#theme' => 'wysiwyg_admin_button_table',
    '#group' => FALSE,
  );

  $plugins = wysiwyg_get_plugins($profile->editor);
  // Generate the button list.
  foreach ($plugins as $name => $meta) {
    if (isset($meta['buttons']) && is_array($meta['buttons'])) {
      foreach ($meta['buttons'] as $button => $title) {
        $icon = '';
        if (!empty($meta['path'])) {
          // @todo Button icon locations are different in editors, editor versions,
          // and contrib/custom plugins (like Image Assist, f.e.).
          $img_src = $meta['path'] . "/images/$name.gif";
          // Handle plugins that have more than one button.
          if (!file_exists($img_src)) {
            $img_src = $meta['path'] . "/images/$button.gif";
          }
          $icon = file_exists($img_src) ? '<img src="' . base_path() . $img_src . '" title="' . $button . '" style="border: 1px solid grey; vertical-align: middle;" />' : '';
        }
        $title = (!empty($icon) ? $icon . ' ' . check_plain($title) : check_plain($title));
        $form['buttons'][$name][$button] = array(
          '#type' => 'checkbox',
          '#title' => $title,
          '#default_value' => !empty($settings['buttons'][$name][$button]) ? $settings['buttons'][$name][$button] : FALSE,
          '#description' => isset($meta['url']) ? l($meta['url'], $meta['url']) : NULL,
        );
      }
    }
    elseif (isset($meta['extensions']) && is_array($meta['extensions'])) {
      foreach ($meta['extensions'] as $extension => $title) {
        $form['buttons'][$name][$extension] = array(
          '#type' => 'checkbox',
          '#title' => check_plain($title),
          '#default_value' => !empty($settings['buttons'][$name][$extension]) ? $settings['buttons'][$name][$extension] : FALSE,
          '#description' => isset($meta['url']) ? l($meta['url'], $meta['url']) : NULL,
        );
      }
    }
  }

  $form['appearance'] = array(
    '#type' => 'fieldset',
    '#title' => t('Editor appearance'),
    '#collapsible' => TRUE,
    '#collapsed' => TRUE,
    '#group' => 'advanced',
  );

  $form['appearance']['theme'] = array(
    '#type' => 'hidden',
    '#value' => $settings['theme'],
  );

  $form['appearance']['language'] = array(
    '#type' => 'select',
    '#title' => t('Interface language'),
    '#default_value' => $settings['language'],
  );
  // @see _locale_prepare_predefined_list()
  require_once $_SERVER['DOCUMENT_ROOT']  . '/includes/locale.inc';
  $predefined = _locale_get_predefined_list();
  foreach ($predefined as $key => $value) {
    // Include native name in output, if possible.
    if (count($value) > 1) {
      $tname = t($value[0]);
      $predefined[$key] = ($tname == $value[1]) ? $tname : "$tname ($value[1])";
    }
    else {
      $predefined[$key] = t($value[0]);
    }
  }
  asort($predefined);
  $form['appearance']['language']['#options'] = $predefined;

  $form['output'] = array(
    '#type' => 'fieldset',
    '#title' => t('Cleanup and output'),
    '#collapsible' => TRUE,
    '#collapsed' => TRUE,
    '#group' => 'advanced',
  );

  $form['css'] = array(
    '#type' => 'fieldset',
    '#title' => t('CSS'),
    '#collapsible' => TRUE,
    '#collapsed' => TRUE,
    '#group' => 'advanced',
  );

  $form['css']['css_setting'] = array(
    '#type' => 'select',
    '#title' => t('Editor CSS'),
    '#default_value' => $settings['css_setting'],
    '#options' => array('theme' => t('Use theme CSS'), 'self' => t('Define CSS'), 'none' => t('Editor default CSS')),
    '#description' => t('Defines the CSS to be used in the editor area.<br />Use theme CSS - loads stylesheets from current site theme.<br/>Define CSS - enter path for stylesheet files below.<br />Editor default CSS - uses default stylesheets from editor.'),
  );

  $form['css']['css_path'] = array(
    '#type' => 'textfield',
    '#title' => t('CSS path'),
    '#default_value' => $settings['css_path'],
    '#size' => 40,
    '#maxlength' => 255,
    '#description' => t('If "Define CSS" was selected above, enter path to a CSS file or a list of CSS files separated by a comma.') . '<br />' . t('Available tokens: <code>%b</code> (base path, eg: <code>/</code>), <code>%t</code> (path to theme, eg: <code>themes/garland</code>), <code>%q</code> (<code>css_js_query_string</code> variable, used for cache-busting)') . '<br />' . t('Example:') . ' css/editor.css,/themes/garland/style.css,%b%t/style.css?%q,http://example.com/external.css',
  );

  if (module_exists('vertical_tabs')) {
    // Add vertical tabs display if available.
    $form['#pre_render'][] = 'vertical_tabs_form_pre_render';
  }

  $form['settings_notes'] = array(
    '#type' => 'fieldset',
    '#weight' => 55,
    '#title' => '&star;&nbsp;' . t('Settings notes'),
    '#collapsible' => TRUE,
    '#collapsed' => TRUE,
  );
  $form['settings_notes']['json']['#value'] = '<div>' . t('Some settings use <a href="!json_url" title="JavaScript Object Notation">JSON</a> syntax to allow complex data structures. Compared to the JSON specification, Wysiwyg module is a bit more flexible with which syntax it accepts to make it easier to copy sample configurations from editor documentation. JSON requires properties and String values to be enclosed in double quotes. Wysiwyg will try to add missing double quotes and replace single quotes, but it only handles simple cases. JSON syntax only allows Objects, Arrays, Strings, Numbers, and Booleans as values, but Wysiwyg can recognize and convert some objects with a specific structures to native JavaScript types otherwise not accepted by JSON.' . '</div>',
      array(
        '!json_url' => url('https://en.wikipedia.org/wiki/JSON'),
      )
    );
  $form['settings_notes']['json_examples'] = array(
    '#type' => 'fieldset',
    '#title' => t('Serializing native types'),
    '#collapsible' => TRUE,
    '#collapsed' => TRUE,
  );
  $form['settings_notes']['json_examples']['function']['#value'] = '<div>' . t('Function reference')
    . ':<br /><pre>{' . "\n  " . '"drupalWysiwygType" : "callback",' . "\n  " . '"name" : "name_of_callback_or_method",' . "\n  " . '"context" : "global.context.object"' . "\n}</pre></div>";
  $form['settings_notes']['json_examples']['regexp']['#value'] = '<div>' . t('RegExp')
    . ':<br /><pre>{' . "\n  " . '"drupalWysiwygType" : "regexp",' . "\n  " . '"regexp" : "\w+\d$",' . "\n  " . '"modifiers" : "gi"' . "\n}</pre></div>";
  $form['settings_notes']['json_examples']['modules']['#value'] = '<p>' . t('Modules implementing hooks may use the helper functions starting with <em>wysiwyg_wrap_js_*</em> to create these objects, see the file <em>wysiwyg.api.php</em>.') . '</p>';

  $form['submit'] = array(
    '#type' => 'submit',
    '#value' => t('Save'),
    '#weight' => 100,
  );
  $form['cancel'] = array(
    '#type' => 'submit',
    '#value' => t('Cancel'),
    '#weight' => 110,
    '#submit' => array('wysiwyg_profile_form_cancel_submit'),
  );

  // Supply contextual information for other callbacks and handlers.
  // @todo Modernize this form for D7+ and declare these earlier.
  // $profile is the primary object of this form, and as an entity, usually
  // expected to live in $form_state[$entity_type].
  $form_state['wysiwyg_profile'] = $profile;
  $form_state['wysiwyg']['editor'] = $editor;
  $form_state['wysiwyg']['plugins'] = $plugins;

  // Allow editor library specific changes to be made to the form.
  if (isset($editor['settings form callback'])) {
    $editor['settings form callback']($form, $form_state);
  }

  foreach (array('appearance', 'output') as $fieldset) {
    if (count(element_children($form[$fieldset])) == 0) {
      $form[$fieldset]['#access'] = FALSE;
    }
  }

  return $form;
}

/**
 * Submit callback for Wysiwyg profile form.
 *
 * @see wysiwyg_profile_form()
 */
function wysiwyg_profile_form_submit($form, &$form_state) {
  $values = $form_state['values'];
  if (isset($values['buttons'])) {
    // Store only enabled buttons for each plugin.
    foreach ($values['buttons'] as $plugin => $buttons) {
      $values['buttons'][$plugin] = array_filter($values['buttons'][$plugin]);
    }
    // Store only enabled plugins.
    $values['buttons'] = array_filter($values['buttons']);
  }
  // Remove input format name.
  $format = $values['format'];
  $input_format = $values['input_format'];
  $editor_name = $values['editor'];
  unset($values['format'], $values['input_format'], $values['editor']);
  $preferences = $values['preferences'];
  unset($values['preferences']);
  $editor = wysiwyg_get_editor($editor_name);
  $version = $editor['installed version'];
  // If the installed version is newer than what is supported, drop the stored
  // number so future upgrades know where to start. Ignore older versions.
  if (!$editor['installed version verified'] && !empty($editor['verified version range'])) {
    $version_range = $editor['verified version range'];
    if (version_compare($version, $version_range[1], '>')) {
      $version = $version_range[1];
    }
  }
  $preferences['version'] = $version;
  $values['_profile_preferences'] = $preferences;

  // Remove FAPI values.
  // @see system_settings_form_submit()
  unset($values['submit'], $values['cancel'], $values['form_id'], $values['op'], $values['form_token'], $values['form_build_id'], $values['advanced__active_tab']);

  // Insert new profile data.
  db_query("UPDATE {wysiwyg} SET editor = '%s', settings = '%s' WHERE format = %d", $editor_name, serialize($values), $format);
  if (!db_affected_rows()) {
    db_query("INSERT INTO {wysiwyg} (format, editor, settings) VALUES (%d, '%s', '%s')", $format, $editor_name, serialize($values));
  }

  // Clear the editing caches.
  if (module_exists('ctools')) {
    ctools_include('object-cache');
    ctools_object_cache_clear('wysiwyg_profile', 'format' . $format);
  }
  else {
    cache_clear_all('wysiwyg_profile:format' . $format, 'cache');
  }
  wysiwyg_profile_cache_clear();

  $formats = filter_formats();
  drupal_set_message(t('Wysiwyg profile for %format has been saved.', array('%format' => $formats[$format]->name)));

  $form_state['redirect'] = 'admin/settings/wysiwyg';
}

/**
 * Cancel submit handler for Wysiwyg profile form.
 *
 * @see wysiwyg_profile_form()
 */
function wysiwyg_profile_form_cancel_submit($form, &$form_state) {
  $format = $form_state['values']['format'];
  // Clear the editing caches.
  if (module_exists('ctools')) {
    ctools_include('object-cache');
    ctools_object_cache_clear('wysiwyg_profile', 'format' . $format);
  }
  else {
    cache_clear_all('wysiwyg_profile:format' . $format, 'cache');
  }
  $form_state['redirect'] = 'admin/settings/wysiwyg';
}

/**
 * Validation helper for JSON based elements.
 *
 * Ensures double quotes are used around property names and values.
 *
 * @param $element
 *   The form element with a '#value' property to validate.
 * @param $form_state
 *   The form state to update with the processed value.
 */
function _wysiwyg_settings_form_validate_json_object($element, &$form_state) {
  $ret = array(
    'valid' => TRUE,
  );
  if (!empty($element['#value'])) {
    $value = $element['#value'];
    // Ensure double quotes are used around property names.
    $value = preg_replace('/(?<=^|,|\n|{)(\s*)(\'?)(\w+)\2\s*:/', '$1"$3":', $value);
    // Ensure double quotes are used around string values.
    $value = preg_replace('/(?<=^|,|\n|{)\s*"(\w+)"\s*:\s*\'(.*?)\'\s*(?=$|\n|,|})/', '"$1":"$2"', $value);
    $ret['processed value'] = $value;
    form_set_value($element, $value, $form_state);
    $ret['valid'] = (json_decode($value) !== NULL);
    if (!$ret['valid']) {
      $ret['message'] = t('The value needs to be a valid JSON object.') . '&nbsp;&star;';
    }
  }
  return $ret;
}

/**
 * Layout for the buttons in the Wysiwyg Editor profile form.
 */
function theme_wysiwyg_admin_button_table($form) {
  $buttons = array();

  // Flatten forms array.
  foreach (element_children($form) as $name) {
    foreach (element_children($form[$name]) as $button) {
      $buttons[] = drupal_render($form[$name][$button]);
    }
  }

  // Split checkboxes into rows with 3 columns.
  $total = count($buttons);
  $rows = array();
  for ($i = 0; $i < $total; $i++) {
    $row = array();
    $row[] = array('data' => $buttons[$i]);
    if (isset($buttons[++$i])) {
      $row[] = array('data' => $buttons[$i]);
    }
    if (isset($buttons[++$i])) {
      $row[] = array('data' => $buttons[$i]);
    }
    $rows[] = $row;
  }

  $output = theme('table', array(), $rows, array('width' => '100%'));

  return $output;
}

/**
 * Display overview of setup Wysiwyg Editor profiles; menu callback.
 */
function wysiwyg_profile_overview() {
  include_once './includes/install.inc';

  // Check which wysiwyg editors are installed.
  $editors = wysiwyg_get_all_editors();
  $count = count($editors);
  $status = array();
  $editor_options = array();

  foreach ($editors as $name => $editor) {
    $status[$name] = array(
      'severity' => REQUIREMENT_INFO,
      'title' => t('<a href="!vendor-url">@editor</a> (<a href="!download-url">Download</a>)',
        array(
          '!vendor-url' => $editor['vendor url'],
          '@editor' => $editor['title'],
          '!download-url' => $editor['download url'],
        )
      ),
      'value' => t('Not installed.'),
      'description' => (isset($editor['error']) ? $editor['error'] : ''),
    );
    if (isset($editor['error'])) {
      $severity = REQUIREMENT_ERROR;
    }
    elseif ($editor['installed']) {
      $editor_options[$name] = check_plain($editor['title']) . ' ' . check_plain($editor['installed version']);
      if (!$editor['installed version verified']) {
        $status[$name]['severity'] = REQUIREMENT_WARNING;
      }
      else {
        $status[$name]['severity'] = REQUIREMENT_OK;
      }
      $status[$name]['value'] = $editor['installed version'];
    }
    else {
      // Build on-site installation instructions.
      // @todo Setup $library in wysiwyg_load_editor() already.
      $library = (isset($editor['library']) ? $editor['library'] : key($editor['libraries']));
      $targs = array(
        '@editor-path' => $editor['editor path'],
        '@library-filepath' => $editor['library path'] . '/' . (isset($editor['libraries'][$library]['files'][0]) ? $editor['libraries'][$library]['files'][0] : key($editor['libraries'][$library]['files'])),
      );
      $instructions = '<p>' . t('Extract the archive and copy its contents into a new folder in the following location:<br /><code>@editor-path</code>', $targs) . '</p>';
      $instructions .= '<p>' . t('So the actual library can be found at:<br /><code>@library-filepath</code>', $targs) . '</p>';

      // Add any install notes.
      if (!empty($editor['install note callback']) && function_exists($editor['install note callback'])) {
        $instructions .= '<div class="editor-install-note">' . $editor['install note callback']() . '</div>';
      }

      $status[$name]['description'] .= $instructions;
      $count--;
    }
    if (!empty($editor['verified version range'])) {
      $status[$name]['value'] .= '<br />(' . $editor['verified version range'][0] . ' - ' . $editor['verified version range'][1] . ')*';
    }
    // In case there is an error, always show installation instructions.
    if (isset($editor['error'])) {
      $show_instructions = TRUE;
    }
  }
  if (!$count) {
    $show_instructions = TRUE;
  }
  $form['status'] = array(
    '#type' => 'fieldset',
    '#title' => t('Installation instructions'),
    '#collapsible' => TRUE,
    '#collapsed' => !isset($show_instructions),
    '#description' => t('A complete list of <a href="@url">supported editor versions</a> for all Wysiwyg module versions can be found on drupal.org.', array('@url' => url('https://www.drupal.org/node/596966')))
    . (!$count ? ' ' . t('There are no editor libraries installed currently. The following list contains a list of currently supported editors:') : '')
    . '<br>' . t('The instructions apply to the latest supported editor version. Paths for previous versions may differ.')
    . '<br>' . t('In general: Unpack the downloaded library archive directly into the libraries folder. You may need to rename the top folder to exactly match the plain library name.'),
    '#weight' => 10,
  );
  $form['status']['report'] = array('#value' => theme('status_report', $status));
  $form['status']['notes'] = array(
    '#prefix' => '<div>',
    '#value' => '* ' . t('The lowest and highest editor library version the current release of Wysiwyg module was last tested by the module maintainers.<br />Using a verified editor version is not a guaratee that any version of Wysiwyg module or an editor library is without problems. The verified version range only indicates a few manual tests have been performed on the first and last editor versions in the range together with the current Wysiwyg module version. <u>Always try the latest verified version before reporting bugs.</u> Unless otherwise noted; the testing was performed using the <strong>"default" or "full" package</strong> available for download from the editor\'s official website. Wysiwyg will <em>try</em> to use any recognized version above the verified version range, but proceed with caution. Editor versions lower than the verified range are <u>not supported at all</u>.<br /> More information about supported editor libraries and the verified versions can be found on the <a target="_blank" title="Supported editors" href="@project-url">wiki</a>.', array('@project-url' => url('https://www.drupal.org/node/596966'))),
    '#suffix' => '</div>',
  );

  if (!$count) {
    return $form;
  }

  $formats = filter_formats();
  wysiwyg_profile_cache_clear();
  $profiles = wysiwyg_profile_load_all();
  $form['formats'] = array(
    '#type' => 'item',
    '#description' => t('To assign a different editor to a text format, click "delete" to remove the existing first.'),
    '#tree' => TRUE,
  );
  $format_options = array();
  foreach ($formats as $id => $format) {
    if (($profile = (!empty($profiles[$id]) ? $profiles[$id] : FALSE))) {
      $form['formats'][$id]['name'] = array(
        '#value' => check_plain($format->name),
      );
      $editor_name = $profile->editor;
      $installed = !empty($editors[$editor_name]['installed']);
      $profile_version = (isset($profile->preferences['version']) ? $profile->preferences['version'] : NULL);
      $editor_message = '';
      if ($installed) {
        if ($profile_version != $editors[$editor_name]['installed version']) {
          $editor_message = '<div class="messages warning">' . check_plain($editors[$editor_name]['title']) . ' (' . t('Expected version: %profile_version but found %installed_version.', array('%profile_version' => $profile_version, '%installed_version' => $editors[$editor_name]['installed version'])) . ')</div>';
        }
        elseif (!$editors[$editor_name]['installed version verified']) {
          $editor_message = '<div class="messages warning">' . check_plain($editors[$editor_name]['title']) . ' (' . t('Version %installed_version is not verified', array('%installed_version' => $editors[$editor_name]['installed version'])) . ')</div>';
        }
        else {
          $editor_message = t('@library @profile_version', array('@library' => $editors[$editor_name]['title'], '@profile_version' => $profile_version));
        }
      }
      else {
        $editor_message = '<div class="messages error">' . t('Unable to find @library. Expected version: %profile_version. Reinstall the library to edit this profile.', array('@library' => $editors[$editor_name]['title'], '%profile_version' => $profile_version)) . '</div>';
      }
      $form['formats'][$id]['editor']['#value'] = $editor_message;
      if ($editors[$profile->editor]['installed']) {
        $form['formats'][$id]['edit'] = array(
          '#value' => l(t('Edit'), "admin/settings/wysiwyg/profile/$id"),
        );
      }
      $form['formats'][$id]['delete'] = array(
        '#value' => l(t('Delete'), "admin/settings/wysiwyg/profile/$id/delete"),
      );
    }
    else {
      $format_options[$id] = $format->name;
    }
  }

  $form['formats']['_new_profile']['name'] = array(
    '#prefix' => '<div class="label-input"><div class="add-new-placeholder">' . t('Assign an editor profile to a format') . '</div>',
    '#suffix' => '</div>',
  );
  if (!empty($format_options)) {
    $form['formats']['_new_profile']['name'] += array(
      '#type' => 'select',
      '#title' => t('Select a format'),
      '#title_display' => 'invisible',
      '#empty_option' => t('- Select a format -'),
      '#default_value' => '',
      '#options' => $format_options,
    );
  }
  else {
    $form['formats']['_new_profile']['name'] += array(
      '#value' => t('All formats have been assigned an editor profile'),
    );
  }
  if (!empty($editor_options)) {
    $form['formats']['_new_profile']['editor'] = array(
      '#type' => 'select',
      '#title' => t('Select an editor'),
      '#title_display' => 'invisible',
      '#empty_option' => t('- Select an editor -'),
      '#default_value' => '',
      '#options' => $editor_options,
    );
  }
  else {
    $form['formats']['_new_profile']['editor'] = array(
      '#value' => t('No editors installed.'),
    );
  }
  $form['formats']['_new_profile']['editor']['#prefix'] = '<div class="add-new-placeholder">&nbsp;</div>';
  $form['formats']['_new_profile']['submit'] = array(
    '#type' => 'submit',
    '#value' => t('Create profile'),
    '#prefix' => '<div class="add-new-placeholder">&nbsp;</div>',
  );

  return $form;
}

/**
 * Return HTML for the Wysiwyg profile overview form.
 */
function theme_wysiwyg_profile_overview($form) {
  if (!isset($form['formats'])) {
    return;
  }
  $output = '';
  $header = array(t('Input format'), t('Editor'), array('data' => t('Operations'), 'colspan' => 2));
  $table_rows = array();
  foreach (element_children($form['formats']) as $form_row_name) {
    $form_row = &$form['formats'][$form_row_name];
    $editor_column_output = drupal_render($form_row['editor']);
    $table_row = array(
      'data' => array(
        drupal_render($form_row['name']),
        $editor_column_output,
      ),
    );
    if ($form_row_name == '_new_profile') {
      // This is the "create profile" row.
      $table_row['data'][] = array(
        'data' => drupal_render($form_row['submit']),
        'colspan' => 2,
      );
    }
    else {
      $table_row['data'][] = isset($form_row['edit']) ? drupal_render($form_row['edit']) : '';
      $table_row['data'][] = isset($form_row['delete']) ? drupal_render($form_row['delete']) : '';
    };
    $table_rows[] = $table_row;
  }
  $form['formats']['table']['#value'] = theme('table', $header, $table_rows, array(), t('Wysiwyg profiles'));
  $output .= drupal_render($form);
  return $output;
}

/**
 * Validate callback for Wysiwyg profile overview form.
 *
 * @see wysiwyg_profile_overview()
 */
function wysiwyg_profile_overview_validate($form, &$form_state) {
  $new = $form_state['values']['formats']['_new_profile'];
  if (empty($new['name'])) {
    form_set_error('formats][new][name', t('You must select a format.'));
  }
  else {
    $profile = wysiwyg_profile_load($new['name']);
    if (!empty($profile)) {
      form_set_error('formats][new][name', t('An editor is already assigned to this format.'));
    }
  }
  if (empty($new['editor'])) {
    form_set_error('formats][new][editor', t('You must select an editor.'));
  }
  else {
    $editor = wysiwyg_get_editor($form_state['values']['formats']['_new_profile']['editor']);
    if (empty($editor)) {
      form_set_error('formats][new][editor', t('The selected editor was not found.'));
    }
  }
}

/**
 * Submit callback for Wysiwyg profile overview form.
 *
 * @see wysiwyg_profile_overview()
 */
function wysiwyg_profile_overview_submit($form, &$form_state) {
  $editor = wysiwyg_get_editor($form_state['values']['formats']['_new_profile']['editor']);
  $format = $form_state['values']['formats']['_new_profile']['name'];

  $profile = array(
    'name' => 'format' . $format,
    'new' => TRUE,
    'editing' => TRUE,
    'format' => $format,
    'editor' => $editor['name'],
    'settings' => array(),
    'preferences' => array(
      'default' => TRUE,
      'show_toggle' => TRUE,
      'user_choose' => FALSE,
      'version' => $editor['installed version'],
    ),
  );
  $profile = (object) $profile;

  // Cache the profile for editing.
  wysiwyg_ui_profile_cache_set($profile);
  // If there is a destination query, ensure we still redirect the user to the
  // edit view page, and then redirect the user to the destination.
  $destination = array();
  if (isset($_GET['destination'])) {
    $destination = drupal_get_destination();
    unset($_GET['destination']);
  }
  $form_state['redirect'] = array('admin/settings/wysiwyg/profile/' . $format . '/edit', array('query' => $destination));
}

/**
 * Delete editor profile confirmation form.
 */
function wysiwyg_profile_delete_confirm(&$form_state, $profile) {
  $formats = filter_formats();
  $format = $formats[$profile->format];
  $form['format'] = array('#type' => 'value', '#value' => $profile->format);
  return confirm_form(
    $form,
    t('Are you sure you want to remove the profile for %name?', array('%name' => $format->name)),
    'admin/settings/wysiwyg',
    t('This action cannot be undone.'), t('Remove'), t('Cancel')
  );
}

/**
 * Submit callback for Wysiwyg profile delete form.
 *
 * @see wysiwyg_profile_delete_confirm()
 */
function wysiwyg_profile_delete_confirm_submit($form, &$form_state) {
  $formats = filter_formats();
  $format = $formats[$form_state['values']['format']];
  wysiwyg_profile_delete($format->format);
  drupal_set_message(t('Wysiwyg profile for %name has been deleted.', array('%name' => $format->name)));
  $form_state['redirect'] = 'admin/settings/wysiwyg';
}

/**
 * Break lock confirmation form.
 */
function wysiwyg_profile_break_lock_confirm(&$form_state, $profile) {
  $formats = filter_formats();
  $format = $formats[$profile->format];
  $form['format'] = array('#type' => 'value', '#value' => $profile->format);
  if (empty($profile->locked)) {
    $form['message']['#value'] = t('There is no lock on the profile for %name to break.', array('%name' => $format->name));
    return $form;
  }
  $account = user_load($profile->locked->uid);
  return confirm_form(
    $form,
    t('Are you sure you want to break the lock on the profile for %name?', array('%name' => $format->name)),
    'admin/settings/wysiwyg',
    t('By breaking this lock, any unsaved changes made by !user will be lost!.', array('!user' => theme('username', $account))),
    t('Break lock'), t('Cancel')
  );
}

/**
 * Submit handler to break_lock a profile.
 */
function wysiwyg_profile_break_lock_confirm_submit(&$form, &$form_state) {
  $format = $form_state['values']['format'];
  // Only the CTools cache handles locks.
  if (module_exists('ctools')) {
    ctools_include('object-cache');
    ctools_object_cache_clear_all('wysiwyg_profile', 'format' . $format);
  }
  if (($profile = wysiwyg_profile_load($format))) {
    $form_state['redirect'] = 'admin/settings/wysiwyg/profile/' . $format . '/edit';
    drupal_set_message(t('The lock has been broken and you may now edit this profile.'));
  }
  else {
    $form_state['redirect'] = 'admin/settings/wysiwyg/profile';
    drupal_set_message(t('The lock has been broken and you may now create a new profile.'));
  }
}
