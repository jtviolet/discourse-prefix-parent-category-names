import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("0.11.1", (api) => {
  // Parse enabled categories from settings
  const enabledCategories = settings.ideas_portal_categories
    .split("|")
    .map((id) => parseInt(id, 10))
    .filter((id) => id);

  // Log enabled categories for debugging
  console.log("Category Prefixer: Enabled for categories:", enabledCategories);

  if (!enabledCategories.length) {
    console.log("Category Prefixer: No categories configured");
    return;
  }

  // Helper function to get current category info using the discovery service
  const getCurrentCategoryInfo = () => {
    // Use the discovery service
    const discoveryService = api.container.lookup("service:discovery");
    const currentRoute = discoveryService?.route;
    
    // First check if we're on a category route
    if (!currentRoute || !currentRoute.includes("category")) {
      return null;
    }
    
    // Get the current category from the discoveryService
    const category = discoveryService?.category;
    if (!category) {
      return null;
    }
    
    // Check if this is one of our enabled categories
    if (!enabledCategories.includes(category.id)) {
      return null;
    }
    
    // Return the category info
    return category;
  };

  // Function to update sidebar category names with parent category names
  const updateSidebarCategoryNames = () => {
    // Get all categories from Discourse
    const siteCategories = api.container.lookup("site:main").categories;
    if (!siteCategories || !siteCategories.length) {
      return;
    }
    
    // Find all sidebar category links
    const sidebarCategoryLinks = document.querySelectorAll(".sidebar-section-link-wrapper a.sidebar-section-link");
    
    sidebarCategoryLinks.forEach(link => {
      // Extract category ID from the link's href attribute
      const href = link.getAttribute("href");
      if (!href || !href.includes("/c/")) return;
      
      const match = href.match(/\/c\/(?:.*\/)?(\d+)/);
      if (!match || !match[1]) return;
      
      const categoryId = parseInt(match[1], 10);
      
      // Check if this is one of our enabled categories
      if (!enabledCategories.includes(categoryId)) return;
      
      // Find the category in the site categories
      const category = siteCategories.find(cat => cat.id === categoryId);
      if (!category) return;
      
      // Check if it has a parent category
      if (!category.parent_category_id) return;
      
      // Find the parent category
      const parentCategory = siteCategories.find(cat => cat.id === category.parent_category_id);
      if (!parentCategory) return;
      
      // Get the span that contains the category name
      const nameSpan = link.querySelector(".sidebar-section-link-content-text");
      if (!nameSpan) return;
      
      // Check if the parent name is already prefixed
      const currentText = nameSpan.textContent.trim();
      if (currentText.startsWith(parentCategory.name)) return;
      
      // Update the name to include the parent category name
      nameSpan.textContent = `${parentCategory.name} ${currentText}`;
      console.log(`Category Prefixer: Updated sidebar category name to "${nameSpan.textContent}"`);
    });
  };

  // Watch for DOM changes to update sidebar category names
  api.onAppEvent("page:changed", () => {
    // Use a short delay to ensure sidebar is fully rendered
    setTimeout(updateSidebarCategoryNames, 300);
  });
  
  // Run once on initialization
  setTimeout(updateSidebarCategoryNames, 500);

  // Update banner title when page changes
  api.onPageChange(() => {
    // Get current category info
    const currentCategory = getCurrentCategoryInfo();
    if (!currentCategory) return;
    
    // Find the custom banner title element
    const bannerTitle = document.querySelector(".custom-banner__title");
    if (!bannerTitle) return;
    
    // Get the current title text
    const originalTitle = bannerTitle.textContent.trim();
    
    // Get parent category name if available
    if (!currentCategory.parent_category_id) return;
    
    const siteCategories = api.container.lookup("site:main").categories;
    const parentCategory = siteCategories.find(cat => cat.id === currentCategory.parent_category_id);
    if (!parentCategory) return;
    
    // If title doesn't already include both parent and category names
    if (!originalTitle.includes(currentCategory.name) || !originalTitle.includes(parentCategory.name)) {
      // Set title to "Parent Category"
      bannerTitle.textContent = `${parentCategory.name} ${currentCategory.name}`;
      console.log(`Category Prefixer: Updated banner title to "${bannerTitle.textContent}"`);
    }
  });
});