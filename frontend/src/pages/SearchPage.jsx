import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import SearchForm from "../components/SearchForm";
import TravelCard from "../components/TravelCard";
import { useAuth } from "../context/AuthContext";
import { searchTravels } from "../services/travelService";

function SearchPage() {
  const location = useLocation();
  const navigate  = useNavigate();
  const { isUser } = useAuth();

  const [travels, setTravels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  // Parse URL params — origin/destination are now location_id numbers from dropdown
  const filters = useMemo(
    () => Object.fromEntries(new URLSearchParams(location.search).entries()),
    [location.search]
  );

  const hasSearch = useMemo(
    () => Boolean(filters.type && filters.origin && filters.destination && filters.departureDate),
    [filters]
  );

  useEffect(() => {
    if (!isUser || !hasSearch) {
      setTravels([]);
      return;
    }
    setLoading(true);
    setError("");
    searchTravels(filters)
      .then(setTravels)
      .catch(err => {
        setTravels([]);
        setError(err.message || "Search failed.");
      })
      .finally(() => setLoading(false));
  }, [filters, hasSearch, isUser]);

  const handleSearch = (nextFilters) => {
    const params = new URLSearchParams(nextFilters);
    navigate(`/search?${params.toString()}`);
  };

  if (!isUser) {
    return <Navigate to="/login/user" replace state={{ from: location }} />;
  }

  return (
    <div className="page-shell">
      <section className="section-heading">
        <div>
          <p className="eyebrow">Book Travel</p>
          <h1>Search and book trips</h1>
        </div>
      </section>

      <div className="panel">
        <SearchForm onSearch={handleSearch} initialValues={filters} compact />
      </div>

      {loading && <div className="panel">Searching for trips…</div>}

      {error && <p className="error-text">{error}</p>}

      {!loading && hasSearch && (
        <div className="card-grid">
          {travels.length ? (
            travels.map(travel => <TravelCard key={travel.id} travel={travel} />)
          ) : (
            <div className="panel">
              No trips found for your search. Try a different date or route.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SearchPage;
