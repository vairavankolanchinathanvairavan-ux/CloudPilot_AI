const API = "http://127.0.0.1:8000";

const form = document.getElementById("enrollment-form");
const button = document.getElementById("submit-button");
const message = document.getElementById("message");

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const deviceName = document.getElementById("device-name").value.trim();

    if (!deviceName) {
        message.textContent = "Please enter a device name.";
        message.className = "error";
        return;
    }

    button.disabled = true;
    button.textContent = "Submitting...";
    message.textContent = "";

    try {
        const response = await fetch(`${API}/api/devices/enroll`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                device_name: deviceName
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Registration failed.");
        }

        message.className = "success";
        message.textContent =
            `Registration submitted successfully! Request ID: ${data.request_id}. Waiting for owner approval.`;

        form.reset();

    } catch (error) {
        message.className = "error";
        message.textContent =
            `Unable to submit registration: ${error.message}`;
    } finally {
        button.disabled = false;
        button.textContent = "Submit Registration";
    }
});
