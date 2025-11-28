package com.agentswarm

import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory

/**
 * Agent Swarm IntelliJ Plugin
 */
class AgentSwarmToolWindowFactory : ToolWindowFactory {
    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val contentManager = toolWindow.contentManager
        val content = contentManager.factory.createContent(
            AgentSwarmPanel(project).panel,
            "",
            false
        )
        contentManager.addContent(content)
    }
}

