INSTALLED_APPS = [
    'edit.apps.EditConfig',
    # ...
]

APP_BASEURL = '/edit/'
#APPEND_SLASH = True

#Which interfaces are available for edit / view
INTERFACES = {'edit' : ['i', 'lbl'] , 'view' : ['i', 'lbl', 'sbs', 't' ]}


