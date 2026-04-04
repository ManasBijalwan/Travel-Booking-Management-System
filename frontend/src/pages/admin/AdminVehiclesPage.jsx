import { useEffect, useMemo, useState } from "react";
import AdminResourcePage from "../../components/AdminResourcePage";
import {
  deleteAdminResource,
  getAdminResource,
  getVehicleFormOptions,
  upsertAdminResource
} from "../../services/travelService";

function AdminVehiclesPage() {
  const [records, setRecords] = useState([]);
  const [modeOptions, setModeOptions] = useState([]);
  const [operatorOptions, setOperatorOptions] = useState([]);

  const loadRecords = async () => {
    const result = await getAdminResource("vehicles");
    setRecords(result);
  };

  const loadOptions = async () => {
    const result = await getVehicleFormOptions();
    setModeOptions(result.modes);
    setOperatorOptions(result.operators);
  };

  useEffect(() => {
    loadRecords();
    loadOptions();
  }, []);

  const fields = useMemo(
    () => [
      { name: "mode_id", label: "Mode", type: "select", options: modeOptions },
      {
        name: "operator_id",
        label: "Operator ID",
        type: "datalist",
        options: operatorOptions
      },
      { name: "vehicle_number", label: "Vehicle Number" },
      { name: "vehicle_name", label: "Vehicle Name" },
      { name: "total_seats", label: "Total Seats", type: "number" },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: ["operational", "non operational"]
      }
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
      description="Add and manage vehicles by schema fields."
      fields={fields}
      records={records}
      onSave={handleSave}
      onDelete={handleDelete}
    />
  );
}

export default AdminVehiclesPage;
