#from django import template
from django.template.defaulttags import register

import settings

@register.filter
def can_edit(role):
    if role in settings.CAN_EDIT:
        return True
    return False

@register.filter
def get_workflow(role):
    workflows = settings.WORKFLOWS

    for wf_id, wf in workflows.items() :
        if role in wf['perms'] :
            return wf
    
    #not sure? return a default
    return workflows['default']
