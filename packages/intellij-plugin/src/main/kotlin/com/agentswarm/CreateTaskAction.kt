package com.agentswarm

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import javax.swing.JOptionPane

class CreateTaskAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val description = JOptionPane.showInputDialog(
            e.project,
            "Enter task description:",
            "Create Agent Swarm Task",
            JOptionPane.QUESTION_MESSAGE
        )
        
        if (description != null && description.isNotEmpty()) {
            // TODO: Implement API call to create task
            JOptionPane.showMessageDialog(
                e.project,
                "Task created: $description",
                "Success",
                JOptionPane.INFORMATION_MESSAGE
            )
        }
    }
}

