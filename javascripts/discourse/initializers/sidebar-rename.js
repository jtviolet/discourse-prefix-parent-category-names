import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("0.11.1", (api) => {
  // Parse enabled categories from settings
  const enabledCategories = settings.enabled_categories
    ? settings.enabled_categories.split("|").map(id => parseInt(id, 10)).filter(id => !isNaN(id))
    : [];

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
      
      // Get the current text and check if it already has the parent name
      const currentText = nameSpan.textContent.trim();
      
      // Get the original category name (without parent prefix)
      const categoryName = category.name;
      
      // If currentText already includes the parent name, don't add it again
      if (currentText.startsWith(parentCategory.name)) return;
      
      // Check if text already contains the parent prefix to avoid duplication
      if (currentText === categoryName) {
        // Update the name to include the parent category name
        nameSpan.textContent = `${parentCategory.name} ${categoryName}`;
        console.log(`Category Prefixer: Updated sidebar category name to "${nameSpan.textContent}"`);
      }
    });
  };

  // Function to update the banner title with parent category prefix
  const updateBannerTitle = () => {
    // Get current category info
    const currentCategory = getCurrentCategoryInfo();
    if (!currentCategory) return;
    
    // Get all categories from Discourse
    const siteCategories = api.container.lookup("site:main").categories;
    if (!siteCategories || !siteCategories.length) return;
    
    // Check if it has a parent category
    if (!currentCategory.parent_category_id) return;
    
    // Find the parent category
    const parentCategory = siteCategories.find(cat => cat.id === currentCategory.parent_category_id);
    if (!parentCategory) return;
    
    // Find the banner title elements - try different selectors based on Discourse versions
    const bannerTitleSelectors = [
      ".category-heading h1", // Modern Discourse
      ".category-title-header .category-title", // Some themes
      "h1.category-title", // Another variation
      ".category-title-header h1", // Yet another variation
      ".custom-banner__title" // Your existing selector
    ];
    
    // Try each selector
    let bannerTitle = null;
    for (const selector of bannerTitleSelectors) {
      bannerTitle = document.querySelector(selector);
      if (bannerTitle) break;
    }
    
    if (!bannerTitle) {
      console.log("Category Prefixer: Could not find banner title element");
      return;
    }
    
    // Get the current title text
    const originalTitle = bannerTitle.textContent.trim();
    
    // Get the original category name
    const categoryName = currentCategory.name;
    
    // If title already includes the parent name, don't add it again
    if (originalTitle.startsWith(parentCategory.name)) return;
    
    // Update the title to include the parent category name
    bannerTitle.textContent = `${parentCategory.name} ${categoryName}`;
    console.log(`Category Prefixer: Updated banner title to "${bannerTitle.textContent}"`);
  };

  // Watch for DOM changes to update sidebar category names
  api.onAppEvent("page:changed", () => {
    // Use a short delay to ensure sidebar is fully rendered
    setTimeout(() => {
      updateSidebarCategoryNames();
      updateBannerTitle();
    }, 100);
  });
  
  // Run once on initialization with a delay to ensure DOM is ready
  setTimeout(() => {
    updateSidebarCategoryNames();
    updateBannerTitle();
  }, 500);

  // Update sidebar and banner when page changes
  api.onPageChange(() => {
    setTimeout(() => {
      updateSidebarCategoryNames();
      updateBannerTitle();
    }, 100);
  });
});