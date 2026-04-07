import { useEffect, useMemo, useState } from "react";
import AdminResourcePage from "../../components/AdminResourcePage";
import {
  deleteAdminResource,
  getAdminResource,
  getVehicleFormOptions,
  upsertAdminResource,
} from "../../services/adminService";

function AdminVehiclesPage() {
  const [records, setRecords] = useState([]);
  const [modeOptions, setModeOptions] = useState([]);
  const [operatorOptions, setOperatorOptions] = useState([]);

  const loadRecords = async () => {
    const result = await getAdminResource("vehicles");
    setRecords(result);
  };

  useEffect(() => {
    loadRecords();
    getVehicleFormOptions().then((opts) => {
      setModeOptions(opts.modes);
      setOperatorOptions(opts.operators);
    });
  }, []);

  const fields = useMemo(
    () => [
      { name: "mode_id", label: "Mode", type: "select", options: modeOptions },
      {
        name: "operator_id",
        label: "Operator",
        type: "select",
        options: operatorOptions,
      },
      { name: "vehicle_number", label: "Vehicle Number" },
      { name: "vehicle_name", label: "Vehicle Name" },
      { name: "total_seats", label: "Total Seats", type: "number" },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: [
          { value: "operational", label: "Operational" },
          { value: "non operational", label: "Non Operational" },
        ],
      },
    ],
    [modeOptions, operatorOptions]
  );

  const handleSave = async (record) => {
    await upsertAdminResource("vehicles", record);
    await loadRecords();
  };

  const handleDelete = async (recordId) => {
    await deleteAdminResource("vehicles", recordId);
    await loadRecords();
  };

  return (
    <AdminResourcePage
      title="Vehicles"
      description="Add and manage vehicles assigned to routes."
      fields={fields}
      records={records}
      onSave={handleSave}
      onDelete={handleDelete}
    />
  );
}

export default AdminVehiclesPage;
