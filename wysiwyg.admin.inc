<?php

/**
 * @file
 * Integrate Wysiwyg editors into Drupal.
 */

/**
 * Prepare default properties for profile.
 */
function wysiwyg_profile_default($profile) {
  // Merge in defaults.
  $profile = (array) $profile;
  $profile += array(
    'format' => '',
    'editor' => '',
  );
  if (empty($profile['settings'])) {
    $profile['settings'] = array();
  }
  $profile['settings'] += array(
    'default' => TRUE,
    'user_choose' => FALSE,
    'show_toggle' => TRUE,
    'theme' => 'advanced',
    'language' => 'en',
    'access' => 1,
    'access_pages' => "node/*\nuser/*\ncomment/*",
    'toolbar' => array(),
    'toolbar_loc' => 'top',
    'toolbar_align' => 'left',
    'path_loc' => 'bottom',
    'resizing' => TRUE,
    // Also available, but buggy in TinyMCE 2.x: blockquote,code,dt,dd,samp.
    'block_formats' => 'p,address,pre,h2,h3,h4,h5,h6,div',
    'verify_html' => TRUE,
    'preformatted' => FALSE,
    'convert_fonts_to_spans' => TRUE,
    'remove_linebreaks' => TRUE,
    'apply_source_formatting' => FALSE,
    'paste_auto_cleanup_on_paste' => FALSE,
    'css_setting' => 'theme',
    'css_path' => NULL,
    'css_classes' => NULL,
  );
  $profile = (object) $profile;
  return $profile;
}

/**
 * Form builder for Wysiwyg profile form.
 */
function wysiwyg_profile_form($form, &$form_state, $profile) {
  $profile = wysiwyg_profile_default($profile);

  $formats = filter_formats();
  $editor = wysiwyg_get_editor($profile->editor);
  drupal_set_title(t('%editor profile for %format', array('%editor' => $editor['title'], '%format' => $formats[$profile->format]->name)), PASS_THROUGH);

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

  $form['basic']['default'] = array(
    '#type' => 'checkbox',
    '#title' => t('Enabled by default'),
    '#default_value' => $profile->settings['default'],
    '#return_value' => 1,
    '#description' => t('The default editor state for users having access to this profile. Users are able to override this state if the next option is enabled.'),
  );

  $form['basic']['user_choose'] = array(
    '#type' => 'checkbox',
    '#title' => t('Allow users to choose default'),
    '#default_value' => $profile->settings['user_choose'],
    '#return_value' => 1,
    '#description' => t('If allowed, users will be able to choose their own editor default state in their user account settings.'),
  );

  $form['basic']['show_toggle'] = array(
    '#type' => 'checkbox',
    '#title' => t('Show <em>enable/disable rich text</em> toggle link'),
    '#default_value' => $profile->settings['show_toggle'],
    '#return_value' => 1,
    '#description' => t('Whether or not to show the <em>enable/disable rich text</em> toggle link below a textarea. If disabled, the user setting or global default is used (see above).'),
  );

  $form['basic']['theme'] = array(
    '#type' => 'hidden',
    '#value' => $profile->settings['theme'],
  );

  $form['basic']['language'] = array(
    '#type' => 'select',
    '#title' => t('Interface language'),
    '#default_value' => $profile->settings['language'],
  );
  // @see _locale_prepare_predefined_list()
  require_once DRUPAL_ROOT . '/includes/iso.inc';
  $predefined = _locale_get_predefined_list();
  foreach ($predefined as $key => $value) {
    // Include native name in output, if possible
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

  // Retrieve all available plugins and buttons.
  $plugins = wysiwyg_get_plugins($profile->editor);
  $form['plugins'] = array(
    '#type' => 'fieldset',
    '#title' => t('Plugins'),
    '#collapsible' => TRUE,
    '#collapsed' => TRUE,
    '#tree' => TRUE,
    '#theme' => 'wysiwyg_admin_plugin_table',
    '#access' => !empty($plugins),
  );

  $buttons = array();
  $proxy = (isset($editor['proxy plugin']) ? key($editor['proxy plugin']) : FALSE);
  foreach ($plugins as $name => $meta) {
    $title = (!empty($meta['title']) ? $meta['title'] : (!empty($meta['extensions']) ? $meta['extensions'][$name] : $name));
    $form['plugins'][$name] = array(
      '#type' => 'checkbox',
      '#title' => check_plain($title),
      '#default_value' => !empty($profile->settings['plugins'][$name]),
      '#description' => isset($meta['url']) ? l($meta['url'], $meta['url']) : NULL,
    );
    if (isset($meta['buttons']) && is_array($meta['buttons'])) {
      foreach ($meta['buttons'] as $button_name => $button) {
        $button_name = ($name === $proxy ? $name . '.' . $button_name : $button_name);
        $buttons[$button_name] = (is_array($button) ? $button : array('title' => $button));
        $buttons[$button_name] += array(
          'plugin' => $name,
        );
      }
    }
  }

  $form['toolbar'] = array(
    '#type' => 'textarea',
    '#title' => t('Toolbar definition'),
    '#default_value' => json_encode($profile->settings['toolbar']),
    '#access' => !empty($buttons),
  );

  // Separator.
  if (!empty($editor['toolbar separator'])) {
    $separator = $editor['toolbar separator'] === TRUE ? 'separator' : $editor['toolbar separator'];
    $buttons[$separator] = array(
      'plugin' => 'none',
      'title' => t('Separator'),
      'multiple' => TRUE,
    );
  }
  $toolbar_support = array(
    'toolbar' => $profile->settings['toolbar'],
    'toolbar rows' => !empty($editor['toolbar rows']),
    'toolbar groups' => !empty($editor['toolbar groups']),
    'toolbar separator' => !empty($editor['toolbar separator']) ? $editor['toolbar separator'] : FALSE,
    'buttons' => $buttons,
  );
  $form['toolbar']['#attached']['js'][] = array(
    'data' => array('wysiwyg_toolbar' => $toolbar_support),
    'type' => 'setting',
  );
  $form['toolbar']['#attached']['library'][] = array('wysiwyg', 'wysiwyg.admin');

  $form['appearance'] = array(
    '#type' => 'fieldset',
    '#title' => t('Editor appearance'),
    '#collapsible' => TRUE,
    '#collapsed' => TRUE,
    '#group' => 'advanced',
  );

  $form['appearance']['toolbar_loc'] = array(
    '#type' => 'select',
    '#title' => t('Toolbar location'),
    '#default_value' => $profile->settings['toolbar_loc'],
    '#options' => array('bottom' => t('Bottom'), 'top' => t('Top')),
    '#description' => t('This option controls whether the editor toolbar is displayed above or below the editing area.'),
  );

  $form['appearance']['toolbar_align'] = array(
    '#type' => 'select',
    '#title' => t('Button alignment'),
    '#default_value' => $profile->settings['toolbar_align'],
    '#options' => array('center' => t('Center'), 'left' => t('Left'), 'right' => t('Right')),
    '#description' => t('This option controls the alignment of icons in the editor toolbar.'),
  );

  $form['appearance']['path_loc'] = array(
    '#type' => 'select',
    '#title' => t('Path location'),
    '#default_value' => $profile->settings['path_loc'],
    '#options' => array('none' => t('Hide'), 'top' => t('Top'), 'bottom' => t('Bottom')),
    '#description' => t('Where to display the path to HTML elements (i.e. <code>body > table > tr > td</code>).'),
  );

  $form['appearance']['resizing'] = array(
    '#type' => 'checkbox',
    '#title' => t('Enable resizing button'),
    '#default_value' => $profile->settings['resizing'],
    '#return_value' => 1,
    '#description' => t('This option gives you the ability to enable/disable the resizing button. If enabled, the Path location toolbar must be set to "Top" or "Bottom" in order to display the resize icon.'),
  );

  $form['output'] = array(
    '#type' => 'fieldset',
    '#title' => t('Cleanup and output'),
    '#collapsible' => TRUE,
    '#collapsed' => TRUE,
    '#group' => 'advanced',
  );

  $form['output']['verify_html'] = array(
    '#type' => 'checkbox',
    '#title' => t('Verify HTML'),
    '#default_value' => $profile->settings['verify_html'],
    '#return_value' => 1,
    '#description' => t('If enabled, potentially malicious code like <code>&lt;HEAD&gt;</code> tags will be removed from HTML contents.'),
  );

  $form['output']['preformatted'] = array(
    '#type' => 'checkbox',
    '#title' => t('Preformatted'),
    '#default_value' => $profile->settings['preformatted'],
    '#return_value' => 1,
    '#description' => t('If enabled, the editor will insert TAB characters on tab and preserve other whitespace characters just like a PRE element in HTML does.'),
  );

  $form['output']['convert_fonts_to_spans'] = array(
    '#type' => 'checkbox',
    '#title' => t('Convert &lt;font&gt; tags to styles'),
    '#default_value' => $profile->settings['convert_fonts_to_spans'],
    '#return_value' => 1,
    '#description' => t('If enabled, HTML tags declaring the font size, font family, font color and font background color will be replaced by inline CSS styles.'),
  );

  $form['output']['remove_linebreaks'] = array(
    '#type' => 'checkbox',
    '#title' => t('Remove linebreaks'),
    '#default_value' => $profile->settings['remove_linebreaks'],
    '#return_value' => 1,
    '#description' => t('If enabled, the editor will remove most linebreaks from contents. Disabling this option could avoid conflicts with other input filters.'),
  );

  $form['output']['apply_source_formatting'] = array(
    '#type' => 'checkbox',
    '#title' => t('Apply source formatting'),
    '#default_value' => $profile->settings['apply_source_formatting'],
    '#return_value' => 1,
    '#description' => t('If enabled, the editor will re-format the HTML source code. Disabling this option could avoid conflicts with other input filters.'),
  );

  $form['output']['paste_auto_cleanup_on_paste'] = array(
    '#type' => 'checkbox',
    '#title' => t('Force cleanup on standard paste'),
    '#default_value' => $profile->settings['paste_auto_cleanup_on_paste'],
    '#return_value' => 1,
    '#description' => t('If enabled, the default paste function (CTRL-V or SHIFT-INS) behaves like the "paste from word" plugin function.'),
  );

  $form['css'] = array(
    '#type' => 'fieldset',
    '#title' => t('CSS'),
    '#collapsible' => TRUE,
    '#collapsed' => TRUE,
    '#group' => 'advanced',
  );

  $form['css']['block_formats'] = array(
    '#type' => 'textfield',
    '#title' => t('Block formats'),
    '#default_value' => $profile->settings['block_formats'],
    '#size' => 40,
    '#maxlength' => 250,
    '#description' => t('Comma separated list of HTML block formats. Possible values: <code>@format-list</code>.', array('@format-list' => 'p,h1,h2,h3,h4,h5,h6,div,blockquote,address,pre,code,dt,dd')),
  );

  $form['css']['css_setting'] = array(
    '#type' => 'select',
    '#title' => t('Editor CSS'),
    '#default_value' => $profile->settings['css_setting'],
    '#options' => array('theme' => t('Use theme CSS'), 'self' => t('Define CSS'), 'none' => t('Editor default CSS')),
    '#description' => t('Defines the CSS to be used in the editor area.<br />Use theme CSS - loads stylesheets from current site theme.<br/>Define CSS - enter path for stylesheet files below.<br />Editor default CSS - uses default stylesheets from editor.'),
  );

  $form['css']['css_path'] = array(
    '#type' => 'textfield',
    '#title' => t('CSS path'),
    '#default_value' => $profile->settings['css_path'],
    '#size' => 40,
    '#maxlength' => 255,
    '#description' => t('If "Define CSS" was selected above, enter path to a CSS file or a list of CSS files separated by a comma.') . '<br />' . t('Available tokens: <code>%b</code> (base path, eg: <code>/</code>), <code>%t</code> (path to theme, eg: <code>themes/garland</code>)') . '<br />' . t('Example:') . ' css/editor.css,/themes/garland/style.css,%b%t/style.css,http://example.com/external.css',
  );

  $form['css']['css_classes'] = array(
    '#type' => 'textarea',
    '#title' => t('CSS classes'),
    '#default_value' => $profile->settings['css_classes'],
    '#description' => t('Optionally define CSS classes for the "Font style" dropdown list.<br />Enter one class on each line in the format: !format. Example: !example<br />If left blank, CSS classes are automatically imported from all loaded stylesheet(s).', array('!format' => '<code>[title]=[class]</code>', '!example' => 'My heading=header1')),
  );

  $form['advanced'] = array(
    '#type' => 'vertical_tabs',
    '#weight' => 50,
  );

  $form['actions'] = array('#type' => 'actions');
  $form['actions']['submit'] = array(
    '#type' => 'submit',
    '#value' => t('Save'),
  );
  $form['actions']['cancel'] = array(
    '#type' => 'link',
    '#title' => t('Cancel'),
    '#href' => 'admin/config/content/wysiwyg',
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

  return $form;
}

/**
 * Submit callback for Wysiwyg profile form.
 *
 * @see wysiwyg_profile_form()
 */
function wysiwyg_profile_form_submit($form, &$form_state) {
  $values = &$form_state['values'];
  $editor = $form_state['wysiwyg']['editor'];
  if (isset($values['plugins'])) {
    // Store only enabled plugins.
    $values['plugins'] = array_filter($values['plugins']);
  }
  else {
    $values['plugins'] = array();
  }
  $values['toolbar'] = json_decode($values['toolbar'], FALSE);
  $plugins = wysiwyg_get_plugins($values['editor']);
  // Allow looking up which button is provided by which plugin.
  $plugin_lookup = array();
  foreach ($plugins as $plugin => $meta) {
    if (empty($meta['buttons'])) {
      continue;
    }
    foreach ($meta['buttons'] as $button_name => $button) {
      $plugin_lookup[$button_name] = $plugin;
    }
  }

  // Verify all dependencies are also enabled.
  $additional_plugins = array();
  $dependencies = array();
  $toolbar = (!empty($editor['toolbar rows']) ? $values['toolbar'] : array($values['toolbar']));
  foreach ($toolbar as $row) {
    if (empty($editor['toolbar groups'])) {
      $row = array($row);
    }
    foreach ($row as $group) {
      foreach ($group as $button) {
        // Cross-editor plugin buttons are prefixed by the proxy plugin name.
        if (strpos($button, '.') !== FALSE) {
          list($plugin, $button_id) = explode('.', $button);
        }
        elseif (isset($plugin_lookup[$button]) && !isset($values['plugins'][$plugin_lookup[$button]])) {
          $plugin = $plugin_lookup[$button];
        }
        if (!isset($values['plugins'][$plugin])) {
          $additional_plugins[$plugin] = 1;
        }
        if (!empty($plugins[$plugin]['dependencies'])) {
          $dependencies = array_unique(array_merge($dependencies, $plugins[$plugin]['dependencies']));
        }
      }
    }
  }
  foreach ($values['plugins'] as $plugin => $enabled) {
    if (!empty($plugins[$plugin]['dependencies'])) {
      $dependencies = array_unique(array_merge($dependencies, $plugins[$plugin]['dependencies']));
    }
  }
  // Walk up the dependency chain until a dependency is already enabled.
  while ($dependency = array_pop($dependencies)) {
    if (!isset($values['plugins'][$dependency]) && !isset($additional_plugins[$dependency])) {
      $additional_plugins[$dependency] = 1;
      if (!empty($plugins[$dependency]['dependencies'])) {
        $dependencies = array_unique(array_merge($dependencies, $plugins[$dependency]['dependencies']));
      }
    }
  }
  if (!empty($additional_plugins)) {
    drupal_set_message(t('Additional plugins were automatically enabled because they were required by already enabled plugins or buttons.<br />The enabled plugins were: @plugins', array('@plugins' => implode(', ', array_keys($additional_plugins)))));
    $values['plugins'] = array_merge($values['plugins'], $additional_plugins);
  }

  // Remove any white-space from 'block_formats' setting, since editor
  // implementations rely on a comma-separated list to explode().
  $values['block_formats'] = preg_replace('@\s+@', '', $values['block_formats']);

  // Remove input format name.
  $format = $values['format'];
  $input_format = $values['input_format'];
  $editor = $values['editor'];
  unset($values['format'], $values['input_format'], $values['editor']);

  // Remove internal Form API values.
  form_state_values_clean($form_state);

  // Insert new profile data.
  db_merge('wysiwyg')
    ->key(array('format' => $format))
    ->fields(array(
      'editor' => $editor,
      'settings' => serialize($values),
    ))
    ->execute();
  wysiwyg_profile_cache_clear();

  drupal_set_message(t('Wysiwyg profile for %format has been saved.', array('%format' => $input_format)));

  $form_state['redirect'] = 'admin/config/content/wysiwyg';
}

/**
 * Layout for the plugins in the Wysiwyg Editor profile form.
 */
function theme_wysiwyg_admin_plugin_table($variables) {
  $form = $variables['form'];
  $plugins = array();

  // Flatten forms array.
  foreach (element_children($form) as $plugin) {
    $plugins[] = drupal_render($form[$plugin]);
  }

  // Split checkboxes into rows with 3 columns.
  $total = count($plugins);
  $rows = array();
  for ($i = 0; $i < $total; $i += 3) {
    $row = array();
    $row_plugins = array_slice($plugins, $i, 3) + array_fill(0, 3, array());
    foreach ($row_plugins as $row_plugin) {
      $row[] = array('data' => $row_plugin);
    }
    $rows[] = $row;
  }

  $output = theme('table', array('rows' => $rows, 'attributes' => array('width' => '100%')));

  return $output;
}

/**
 * Display overview of setup Wysiwyg Editor profiles; menu callback.
 */
function wysiwyg_profile_overview($form, &$form_state) {
  include_once './includes/install.inc';

  // Check which wysiwyg editors are installed.
  $editors = wysiwyg_get_all_editors();

  // Sort editors by installed first, then by title.
  foreach ($editors as $key => $row) {
    $installed[$key] = $row['installed'];
    $title[$key] = drupal_strtolower($row['title']);
  }
  array_multisort($installed, SORT_DESC, $title, SORT_ASC, $editors);

  $count = count($editors);
  $status = array();
  $options = array('' => t('No editor'));

  // D7's seven theme displays links in table headers as block elements.
  drupal_add_css('table.system-status-report th a {display: inline;}', 'inline');

  foreach ($editors as $name => $editor) {
    $status[$name] = array(
      'severity' => (isset($editor['error']) ? REQUIREMENT_ERROR : ($editor['installed'] ? REQUIREMENT_OK : REQUIREMENT_INFO)),
      'title' => t('<a href="!vendor-url">@editor</a> (<a href="!download-url">Download</a>)', array('!vendor-url' => $editor['vendor url'], '@editor' => $editor['title'], '!download-url' => $editor['download url'])),
      'value' => (isset($editor['installed version']) ? $editor['installed version'] : t('Not installed.')),
      'description' => (isset($editor['error']) ? $editor['error'] : ''),
    );
    if ($editor['installed']) {
      $options[$name] = $editor['title'] . (isset($editor['installed version']) ? ' ' . $editor['installed version'] : '');
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
    '#description' => (!$count ? t('There are no editor libraries installed currently. The following list contains a list of currently supported editors:') : ''),
    '#weight' => 10,
  );
  $form['status']['report'] = array('#markup' => theme('status_report', array('requirements' => $status)));

  if (!$count) {
    return $form;
  }

  $formats = filter_formats();
  $profiles = wysiwyg_profile_load_all();
  $form['formats'] = array(
    '#type' => 'item',
    '#description' => t('To assign a different editor to a text format, click "delete" to remove the existing first.'),
    '#tree' => TRUE,
  );

  $enable_save = FALSE;
  foreach ($formats as $id => $format) {
    $form['formats'][$id]['name'] = array(
      '#markup' => check_plain($format->name),
    );
    // Only display editor selection for associated input formats to avoid
    // confusion about disabled selection.
    if (isset($profiles[$id]) && !empty($profiles[$id]->editor)) {
      $editor_name = $profiles[$id]->editor;
      $installed = !empty($editors[$editor_name]['installed']);
      $form['formats'][$id]['editor'] = array(
        '#wysiwyg-editor-name' => $editor_name,
      );
      if ($installed) {
        $form['formats'][$id]['editor']['#markup'] = $options[$editor_name];
      }
      else {
        drupal_set_message(t('Missing %editor library for %format format. Re-install the %editor library or delete the editor profile.', array(
          '%editor' => $editors[$editor_name]['title'],
          '%format' => $format->name,
        )), 'warning');
      }
    }
    else {
      $form['formats'][$id]['editor'] = array(
        '#type' => 'select',
        '#default_value' => '',
        '#options' => $options,
      );
      $enable_save = TRUE;
    }
    if (isset($profiles[$id]) && !empty($profiles[$id]->editor)) {
      $form['formats'][$id]['edit'] = array(
        '#markup' => l(t('Edit'), "admin/config/content/wysiwyg/profile/$id/edit"),
      );
      $form['formats'][$id]['delete'] = array(
        '#markup' => l(t('Delete'), "admin/config/content/wysiwyg/profile/$id/delete"),
      );
    }
  }

  // Submitting the form when no editors can be selected causes errors.
  if ($enable_save) {
    $form['submit'] = array('#type' => 'submit', '#value' => t('Save'));
  }
  return $form;
}

/**
 * Return HTML for the Wysiwyg profile overview form.
 */
function theme_wysiwyg_profile_overview($variables) {
  $form = $variables['form'];
  if (!isset($form['formats'])) {
    return;
  }
  $editors = wysiwyg_get_all_editors();
  $output = '';
  $header = array(t('Text format'), t('Editor'), array('data' => t('Operations'), 'colspan' => 2));
  $rows = array();
  foreach (element_children($form['formats']) as $item) {
    $format = &$form['formats'][$item];
    $row = array(
      'data' => array(
        drupal_render($format['name']),
        drupal_render($format['editor']),
        isset($format['edit']) ? drupal_render($format['edit']) : '',
        isset($format['delete']) ? drupal_render($format['delete']) : '',
      ),
    );
    if (empty($row['data'][1])) {
      $row['data'][1] = array(
        'data' => t('Missing library: @library', array('@library' => $editors[$format['editor']['#wysiwyg-editor-name']]['title'])),
        'class' => 'error',
      );
      $row['class'] = array('error');
    }
    $rows[] = $row;
  }
  $form['formats']['table']['#markup'] = theme('table', array('header' => $header, 'rows' => $rows));
  $output .= drupal_render_children($form);
  return $output;
}

/**
 * Submit callback for Wysiwyg profile overview form.
 */
function wysiwyg_profile_overview_submit($form, &$form_state) {
  // The settings handling relies on these to be defined and arrays.
  $settings = array(
    'toolbar' => array(),
    'plugins' => array(),
  );
  foreach ($form_state['values']['formats'] as $format => $values) {
    db_merge('wysiwyg')
      ->key(array('format' => $format))
      ->fields(array(
        'editor' => $values['editor'],
        'settings' => serialize($settings),
      ))
      ->execute();
  }
  wysiwyg_profile_cache_clear();
}

/**
 * Delete editor profile confirmation form.
 */
function wysiwyg_profile_delete_confirm($form, &$form_state, $profile) {
  $formats = filter_formats();
  $format = $formats[$profile->format];
  $form['format'] = array('#type' => 'value', '#value' => $format);
  return confirm_form(
    $form,
    t('Are you sure you want to remove the profile for %name?', array('%name' => $format->name)),
    'admin/config/content/wysiwyg',
    t('This action cannot be undone.'), t('Remove'), t('Cancel')
  );
}

/**
 * Submit callback for Wysiwyg profile delete form.
 *
 * @see wysiwyg_profile_delete_confirm()
 */
function wysiwyg_profile_delete_confirm_submit($form, &$form_state) {
  $format = $form_state['values']['format'];
  wysiwyg_profile_delete($format->format);
  wysiwyg_profile_cache_clear();

  drupal_set_message(t('Wysiwyg profile for %name has been deleted.', array('%name' => $format->name)));
  $form_state['redirect'] = 'admin/config/content/wysiwyg';
}
