import { Navigate, Route, Routes } from "react-router-dom";
import { UserProvider } from "./UserContext";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import Register from "./pages/Register";
import VerifyEmail, { CheckEmail } from "./pages/VerifyEmail";
import Home from "./pages/Home";
import Search from "./pages/Search";
import Organizations, { EventsPage } from "./pages/Organizations";
import OrganizationDetail from "./pages/OrganizationDetail";
import Marketplace from "./pages/Marketplace";
import ListingDetail from "./pages/ListingDetail";
import NewListing from "./pages/NewListing";
import CheckoutPage from "./pages/Checkout";
import Tutoring from "./pages/Tutoring";
import RequestHelp from "./pages/RequestHelp";
import RequestDetail from "./pages/RequestDetail";
import TutorProfileForm from "./pages/TutorProfileForm";
import Messages from "./pages/Messages";
import Account from "./pages/Account";

function App() {
  return (
    <UserProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/register" element={<Register />} />
        <Route path="/check-email" element={<CheckEmail />} />
        <Route path="/verify-email" element={<VerifyEmail />} />

        <Route element={<Layout />}>
          <Route path="/home" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/organizations" element={<Organizations />} />
          <Route path="/organizations/:slug" element={<OrganizationDetail />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/marketplace/new" element={<NewListing />} />
          <Route path="/marketplace/:id" element={<ListingDetail />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/tutoring" element={<Tutoring />} />
          <Route path="/tutoring/request" element={<RequestHelp />} />
          <Route path="/tutoring/requests/:id" element={<RequestDetail />} />
          <Route path="/tutoring/profile" element={<TutorProfileForm />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/account" element={<Account />} />
        </Route>

        <Route path="/listing" element={<Navigate to="/marketplace" replace />} />
        <Route path="/add" element={<Navigate to="/marketplace/new" replace />} />
        <Route path="/help" element={<Navigate to="/tutoring/request" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </UserProvider>
  );
}

export default App;
