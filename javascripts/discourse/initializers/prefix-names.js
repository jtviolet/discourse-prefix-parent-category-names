import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("0.11.1", (api) => {
  // Parse enabled categories from settings
  const enabledCategories = settings.enabled_categories
    ? settings.enabled_categories.split("|").map(id => parseInt(id, 10)).filter(id => !isNaN(id))
    : [];

  if (!enabledCategories.length) {
    return;
  }

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
      }
    });
  };

  // Store the original banner texts (as a global in-memory cache)
  const originalBannerTexts = {};
  
  // Function to update the category banner title
  const updateCategoryBannerTitle = () => {
    // We need to verify we're on a category page first
    const isCategory = document.body.classList.contains("category");
    
    // If we're not on a category page, exit
    if (!isCategory) {
      return;
    }
    
    // Get category info from the discovery service
    const discoveryService = api.container.lookup("service:discovery");
    const category = discoveryService?.category;
    
    if (!category) {
      return;
    }
    
    const categoryId = category.id;
    
    // Find the banner title using various selectors
    const possibleSelectors = [
      "h1.custom-banner__title",
      ".custom-banner__title",
      ".category-title h1",
      ".category-heading h1"
    ];
    
    let bannerTitle = null;
    
    for (const selector of possibleSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        bannerTitle = element;
        break;
      }
    }
    
    if (!bannerTitle) {
      return;
    }
    
    // Get the current title text
    const currentTitle = bannerTitle.textContent.trim();
    
    // Always reset the banner to the category name first
    // This ensures we don't accumulate prefixes
    bannerTitle.textContent = category.name;
    
    // If this is not one of our enabled categories or it doesn't have a parent, we're done
    if (!enabledCategories.includes(categoryId)) {
      return;
    }
    
    // Check if it has a parent category
    if (!category.parent_category_id) {
      return;
    }
    
    // Get all categories from Discourse
    const siteCategories = api.container.lookup("site:main").categories;
    const parentCategory = siteCategories.find(cat => cat.id === category.parent_category_id);
    
    if (!parentCategory) {
      return;
    }
    
    
    // Update the title to include the parent category name
    bannerTitle.textContent = `${parentCategory.name} ${category.name}`;
  };

  // Function to apply all updates
  const applyUpdates = () => {
    updateSidebarCategoryNames();
    updateCategoryBannerTitle();
  };

  // Run once on initialization with a delay to ensure DOM is ready
  applyUpdates();

  // Update when page changes
  api.onPageChange(() => {    
    applyUpdates();
  });
});