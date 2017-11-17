#from django import template
from django.template.defaulttags import register

import settings
import apps.edit.settings as edit_settings

@register.filter
def can_edit(role):
    if role in settings.CAN_EDIT:
        return True
    return False


