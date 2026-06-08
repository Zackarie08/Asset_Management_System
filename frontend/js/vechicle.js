
fetch(`${API_URL}/api/vehicle-maintenance`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    vehicle_id: currentVehicleId,
    maintenance_date: date,
    service_type: type,
    maintenance_cost: cost,
    odometer: odo,
    remarks
  })
});
