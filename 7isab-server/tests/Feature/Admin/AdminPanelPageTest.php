<?php

namespace Tests\Feature\Admin;

use Tests\TestCase;

class AdminPanelPageTest extends TestCase
{
    public function test_every_admin_path_serves_the_single_page_app(): void
    {
        $this->withoutVite();

        foreach (['/admin', '/admin/users', '/admin/users/12', '/admin/admins'] as $path) {
            $this->get($path)->assertOk()->assertSee('<div id="root"></div>', escape: false);
        }
    }
}
