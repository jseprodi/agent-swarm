package com.agentswarm

import com.intellij.openapi.project.Project
import javax.swing.*

/**
 * Agent Swarm Panel UI
 */
class AgentSwarmPanel(private val project: Project) {
    val panel = JPanel().apply {
        layout = BoxLayout(this, BoxLayout.Y_AXIS)
        add(JLabel("Agent Swarm"))
        add(JButton("Create Task").apply {
            addActionListener {
                // Handle task creation
            }
        })
    }
}

