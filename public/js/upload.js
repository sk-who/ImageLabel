// public/js/upload.js

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('uploadForm');
    const statusDiv = document.getElementById('uploadStatus');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault(); // Prevent the default form submission

            const formData = new FormData(form);

            try {
                const response = await fetch('/uploadImage', {
                    method: 'POST',
                    body: formData,
                });

                const data = await response.json();
                console.log('Response data:', data);
                if (data.success) {
                    const imagePreview = document.getElementById('uploadedImage');
                    const labelList = document.getElementById('labelList');

                    // Show image and update its src
                    imagePreview.src = data.imageSrc;
                    imagePreview.style.display = 'block';

                    // Clear old labels
                    labelList.innerHTML = '';

                    // Add new labels
                    data.labels.forEach(label => {
                        const li = document.createElement('li');
                        li.textContent = `• ${label}`;
                        labelList.appendChild(li);
                    });

                } else {
                    statusDiv.textContent = 'Image upload failed.';
                }
            } catch (error) {
                console.error('Upload error:', error);
                statusDiv.textContent = 'An error occurred during upload.';
            }
        });
    }
});
