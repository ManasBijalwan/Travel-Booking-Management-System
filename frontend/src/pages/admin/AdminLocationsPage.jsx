import { useEffect, useState } from "react";
import AdminResourcePage from "../../components/AdminResourcePage";
import {
  deleteAdminResource,
  getAdminResource,
  upsertAdminResource,
} from "../../services/adminService";

const fields = [
  { name: "location_name", label: "Location Name" },
  { name: "city", label: "City" },
  { name: "state", label: "State" },
  {
    name: "location_type",
    label: "Location Type",
    type: "select",
    options: [
      { value: "Airport", label: "Airport" },
      { value: "Bus Stand", label: "Bus Stand" },
      { value: "Railway Station", label: "Railway Station" },
    ],
  },
];

function AdminLocationsPage() {
  const [records, setRecords] = useState([]);

  const loadRecords = async () => {
    const result = await getAdminResource("locations");
    setRecords(result);
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const handleSave = async (record) => {
    await upsertAdminResource("locations", record);
    await loadRecords();
  };

  const handleDelete = async (recordId) => {
    await deleteAdminResource("locations", recordId);
    await loadRecords();
  };

  return (
    <AdminResourcePage
      title="Locations"
      description="Manage airports, bus stands, and railway stations used in the system."
      fields={fields}
      records={records}
      onSave={handleSave}
      onDelete={handleDelete}
    />
  );
}

export default AdminLocationsPage;
