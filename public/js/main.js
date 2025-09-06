// Main JavaScript file for client-side functionality

document.addEventListener("DOMContentLoaded", () => {
  // Auto-hide alerts after 5 seconds
  const alerts = document.querySelectorAll(".alert")
  alerts.forEach((alert) => {
    setTimeout(() => {
      alert.style.opacity = "0"
      setTimeout(() => {
        alert.remove()
      }, 300)
    }, 5000)
  })

  // Confirm delete actions
  const deleteButtons = document.querySelectorAll("[data-confirm-delete]")
  deleteButtons.forEach((button) => {
    button.addEventListener("click", function (e) {
      const message = this.getAttribute("data-confirm-delete") || "Are you sure you want to delete this item?"
      if (!confirm(message)) {
        e.preventDefault()
      }
    })
  })

  // Form validation
  const forms = document.querySelectorAll("form[data-validate]")
  forms.forEach((form) => {
    form.addEventListener("submit", (e) => {
      const requiredFields = form.querySelectorAll("[required]")
      let isValid = true

      requiredFields.forEach((field) => {
        if (!field.value.trim()) {
          field.classList.add("error")
          isValid = false
        } else {
          field.classList.remove("error")
        }
      })

      if (!isValid) {
        e.preventDefault()
        showAlert("Please fill in all required fields.", "error")
      }
    })
  })

  // Password strength indicator
  const passwordInputs = document.querySelectorAll('input[type="password"][data-strength]')
  passwordInputs.forEach((input) => {
    const indicator = document.createElement("div")
    indicator.className = "password-strength"
    input.parentNode.appendChild(indicator)

    input.addEventListener("input", function () {
      const strength = calculatePasswordStrength(this.value)
      indicator.textContent = `Password strength: ${strength.label}`
      indicator.className = `password-strength ${strength.class}`
    })
  })
})

// Utility functions
function showAlert(message, type = "info") {
  const alert = document.createElement("div")
  alert.className = `alert alert-${type}`
  alert.textContent = message

  const container = document.querySelector(".main-content") || document.body
  container.insertBefore(alert, container.firstChild)

  setTimeout(() => {
    alert.remove()
  }, 5000)
}

function calculatePasswordStrength(password) {
  let score = 0

  if (password.length >= 8) score++
  if (password.match(/[a-z]/)) score++
  if (password.match(/[A-Z]/)) score++
  if (password.match(/[0-9]/)) score++
  if (password.match(/[^a-zA-Z0-9]/)) score++

  const levels = [
    { label: "Very Weak", class: "very-weak" },
    { label: "Weak", class: "weak" },
    { label: "Fair", class: "fair" },
    { label: "Good", class: "good" },
    { label: "Strong", class: "strong" },
  ]

  return levels[Math.min(score, 4)]
}

// AJAX helper function
function makeRequest(url, options = {}) {
  const defaults = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  }

  const config = { ...defaults, ...options }

  return fetch(url, config)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      return response.json()
    })
    .catch((error) => {
      console.error("Request failed:", error)
      showAlert("An error occurred. Please try again.", "error")
      throw error
    })
}
