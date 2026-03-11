
// Assuming the use of Leaflet.js for displaying device trajectories

import L from 'leaflet';

// Function to create the map and plot the device trajectory
function plotDeviceTrajectory(trajectoryData) {
    const map = L.map('map').setView([0, 0], 13);  // Initialize the map with a default zoom level

    // Set up tile layer for the map
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Loop through the trajectory data and plot points on the map
    let trajectoryPoints = trajectoryData.map(point => [point.lat, point.lng]);
    L.polyline(trajectoryPoints, { color: 'blue' }).addTo(map);  // Plot the trajectory as a blue line

    // Add markers for device locations along the trajectory
    trajectoryData.forEach(point => {
        L.marker([point.lat, point.lng]).addTo(map)
            .bindPopup(`Device: ${point.device_id}<br>Time: ${point.time}`);
    });
}

// Example of trajectory data in GeoJSON format
const trajectoryData = [
    { lat: 37.7749, lng: -122.4194, device_id: 'device_01', time: '2026-03-11T10:00:00' },
    { lat: 37.7750, lng: -122.4184, device_id: 'device_01', time: '2026-03-11T10:05:00' },
    { lat: 37.7751, lng: -122.4174, device_id: 'device_01', time: '2026-03-11T10:10:00' }
];

// Call the function with example data
plotDeviceTrajectory(trajectoryData);
