package com.agentswarm

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.progress.ProgressIndicator
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.progress.Task
import com.intellij.openapi.ui.Messages
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets
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
            // Get API URL from settings or use default
            val apiUrl = System.getProperty("agentSwarm.apiUrl", "http://localhost:3000")
            val apiKey = System.getProperty("agentSwarm.apiKey")
            
            ProgressManager.getInstance().run(object : Task.Backgroundable(e.project, "Creating Task", true) {
                override fun run(indicator: ProgressIndicator) {
                    indicator.text = "Creating task..."
                    try {
                        val result = createTask(apiUrl, apiKey, description)
                        Messages.showInfoMessage(
                            e.project,
                            "Task created successfully!\nTask ID: ${result.taskId}\nStatus: ${if (result.success) "Success" else "Failed"}",
                            "Task Created"
                        )
                    } catch (ex: Exception) {
                        Messages.showErrorDialog(
                            e.project,
                            "Failed to create task: ${ex.message}",
                            "Error"
                        )
                    }
                }
            })
        }
    }
    
    private fun createTask(apiUrl: String, apiKey: String?, description: String): TaskResult {
        val url = URL("$apiUrl/api/tasks")
        val connection = url.openConnection() as HttpURLConnection
        
        try {
            connection.requestMethod = "POST"
            connection.setRequestProperty("Content-Type", "application/json")
            if (apiKey != null) {
                connection.setRequestProperty("X-API-Key", apiKey)
            }
            connection.doOutput = true
            
            val requestBody = """{"description": "${description.replace("\"", "\\\"")}"}"""
            connection.outputStream.use { os ->
                os.write(requestBody.toByteArray(StandardCharsets.UTF_8))
            }
            
            val responseCode = connection.responseCode
            val responseBody = if (responseCode == 201 || responseCode == 200) {
                connection.inputStream.bufferedReader(StandardCharsets.UTF_8).use { it.readText() }
            } else {
                connection.errorStream?.bufferedReader(StandardCharsets.UTF_8)?.use { it.readText() } ?: ""
            }
            
            if (responseCode == 201 || responseCode == 200) {
                // Parse response (simplified - in production use proper JSON parsing)
                return TaskResult(taskId = "created", success = true)
            } else {
                throw Exception("API returned status $responseCode: $responseBody")
            }
        } finally {
            connection.disconnect()
        }
    }
    
    private data class TaskResult(val taskId: String, val success: Boolean)
}

